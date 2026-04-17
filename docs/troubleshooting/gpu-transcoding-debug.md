# GPU transcoding debug

How the installer finds your GPU, how to override it, and how to prove the transcode is actually running on the hardware you expect.

Relevant services: `jellyfin` and `tdarr` both carry `hwaccelSupport: true` in the catalog.

---

## How detection works

The doctor's vendor probe lives in `src/platform/gpu.ts`. On wizard start and on every `arrstack doctor` run, it does three things:

1. **`lspci -nn`**, parsed for display-class devices (`[0300]`, `[0302]`). The last `[xxxx:yyyy]` on each matching line is the PCI vendor:device pair.
2. **Vendor mapping** of the PCI vendor ID:
   - `8086` -> `intel`
   - `1002` -> `amd`
   - `10de` -> `nvidia`
   - anything else -> `unknown`
3. **Device probes**:
   - Intel / AMD: `existsSync('/dev/dri/renderD128')` to confirm the kernel exposed a render node.
   - NVIDIA: `nvidia-ctk --version` to confirm `nvidia-container-toolkit` is installed.

The result gets written to `state.gpu` as `{ vendor, device_name, render_gid?, video_gid? }` and the Jellyfin service gets the right device mounts and group memberships from `src/renderer/jellyfin-encoding.ts`.

Verify what the probe found:
```bash
jq .gpu ~/arrstack/state.json
lspci -nn | grep -iE '03[02][0-9a-f]'
ls -l /dev/dri/
nvidia-ctk --version 2>/dev/null || echo "no nvidia-container-toolkit"
```

---

## Override in the wizard

If detection got it wrong, or you want to disable acceleration:

```bash
arrstack install --fresh
```

The GPU step in the wizard lets you pick `intel`, `amd`, `nvidia`, or `none` explicitly. For an existing install, hand-edit `state.json`:

```bash
jq '.gpu.vendor = "intel"' ~/arrstack/state.json > /tmp/s && mv /tmp/s ~/arrstack/state.json
arrstack install --resume
```

Setting `"none"` drops every GPU-specific mount and group from Jellyfin/Tdarr. It is the right choice if you want to keep things simple and you have CPU headroom.

---

## Verify transcoding is active

The fastest single check: is ffmpeg running with a hardware acceleration flag? Start a stream that forces a transcode (e.g. pick a lower bitrate in the Jellyfin web player), then:

```bash
docker exec jellyfin ps auxf | grep ffmpeg
```

If Jellyfin's container is named differently on your install (compose default is `arrstack-jellyfin-1`), substitute the name. `ps auxf` prints the process tree with full argv; `grep ffmpeg` narrows to the active transcodes. One ffmpeg process per concurrent stream is expected.

### Interpreting the ffmpeg argv

Scan the command line for the first `-hwaccel <vendor>` flag, which appears before the `-i <input>` argument. The flag tells you exactly which code path ffmpeg took:

| Flag in argv | What it means | Expected on |
|---|---|---|
| `-hwaccel vaapi` + `-vaapi_device /dev/dri/renderD128` | VAAPI decode on the iGPU; encode uses `h264_vaapi` or `hevc_vaapi`. | Intel Quick Sync, AMD |
| `-hwaccel qsv` | Intel Media SDK path (newer Jellyfin builds). Also uses `/dev/dri/renderD128`. | Intel only |
| `-hwaccel cuda` or `-hwaccel nvdec` | NVDEC decode on the NVIDIA GPU; encode uses `h264_nvenc` or `hevc_nvenc`. | NVIDIA |
| no `-hwaccel` flag, plus `-c:v libx264` or `libx265` | Software transcode. GPU is not involved. | any (fallback) |

Also look at the `-c:v` argument near the end of the argv: it names the encoder. `h264_vaapi`, `h264_nvenc`, `h264_qsv` are hardware encoders. `libx264` and `libx265` are CPU-only.

### If `ps auxf | grep ffmpeg` returns nothing

No transcode is running. Either the client is direct-playing (no transcode needed) or the stream has not started yet. Force a transcode by picking a quality lower than the source in the web player, then re-run the command.

### If ffmpeg shows `-hwaccel` but the GPU is idle

The driver initialized the context but fell back to software mid-stream. Check the transcode log:

```bash
docker exec jellyfin tail -n 200 /config/log/FFmpeg.Transcode-$(date +%Y-%m-%d).log
```

Look for `Failed to initialise` or `No usable` lines. The later sections on Intel/AMD/NVIDIA cover the common root causes.

---

## Intel Quick Sync

### Prerequisites

- A recent Intel iGPU (Broadwell or later for full QSV, Skylake+ for H.265).
- `/dev/dri/renderD128` exists on the host.
- The user running Docker is in the `render` or `video` group.

Check them:
```bash
ls -l /dev/dri/
# crw-rw---- 1 root render 226, 128 ...   <- note "render" group

getent group render video
id -nG $USER                     # must include 'render' (or 'video' on some distros)
```

If the render group is missing:
```bash
sudo usermod -aG render $USER
newgrp render
```

### Verify Quick Sync inside Jellyfin

Start a transcode (play a file at a lower quality on a browser client). Then:

```bash
docker exec arrstack-jellyfin-1 ps -ef | grep ffmpeg
```

Expect to see flags like `-hwaccel vaapi -hwaccel_output_format vaapi -vaapi_device /dev/dri/renderD128`. VAAPI is what Jellyfin uses for Intel on Linux.

Watch the iGPU from the host:
```bash
sudo apt install -y intel-gpu-tools          # Ubuntu/Debian
sudo dnf install -y intel-gpu-tools          # Fedora
sudo intel_gpu_top
```

The "Video" and "VideoEnhance" engines should hit > 0 percent while the transcode runs. If they stay at zero, ffmpeg is decoding on the CPU.

### Common Intel failures

- `VAAPI hwaccel requested but none available`: render node missing or permission denied. Run `ls -l /dev/dri/renderD128` from inside the container.
- `Failed to initialise VAAPI connection: -1`: the `intel-media-va-driver` (or `intel-media-va-driver-non-free` for newer codecs) package is missing on the host. The driver is bind-mounted into the container.
- Black video / green frames: your CPU is too old for the codec you enabled. Disable HEVC 10-bit decode in Jellyfin's playback settings.

---

## AMD VAAPI

### Debian / Ubuntu

```bash
sudo apt install -y mesa-va-drivers libva-drm2 libva2 vainfo
ls -l /dev/dri/            # renderD128 should exist
vainfo | head -n 20        # profiles list should mention VAProfileH264* etc.
```

Then in Jellyfin Dashboard -> Playback:
- Hardware acceleration: `VAAPI`
- VA API device: `/dev/dri/renderD128`
- Enable your codecs.

### Fedora

AMD on Fedora needs the RPM Fusion `mesa-va-drivers-freeworld` package for non-free codec support:

```bash
sudo dnf install -y https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
sudo dnf swap mesa-va-drivers mesa-va-drivers-freeworld
vainfo | grep VAProfile
```

On SELinux-enforcing Fedora, the Jellyfin bind mounts must carry the `:Z` label (the installer does this). If you bypassed it:
```bash
sudo chcon -R -t container_file_t ~/arrstack/config/jellyfin
```

### Verify AMD transcoding

Same process as Intel: `docker exec arrstack-jellyfin-1 ps -ef | grep ffmpeg` and look for `-hwaccel vaapi`. From the host:

```bash
sudo dnf install -y radeontop       # Fedora
sudo apt install -y radeontop       # Debian/Ubuntu
sudo radeontop
```

The "VGT" (Vertex Grouper / Tessellator) and "EE" (Event Engine) bars stay busy during a transcode.

---

## NVIDIA

### Install nvidia-container-toolkit

Ubuntu / Debian:
```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Fedora:
```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo \
  | sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo
sudo dnf install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Confirm the toolkit is visible to Docker:
```bash
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

If that prints the GPU, the host is ready. Now update the stack so Jellyfin gets the `deploy.resources.reservations.devices` block:

```bash
arrstack update
docker compose -f ~/arrstack/docker-compose.yml up -d --force-recreate jellyfin
```

### Verify NVIDIA transcoding

```bash
docker exec arrstack-jellyfin-1 nvidia-smi              # should list the GPU
docker exec arrstack-jellyfin-1 ps -ef | grep ffmpeg    # look for -hwaccel cuda or nvdec
```

From the host, watch GPU utilization while a transcode runs:

```bash
nvidia-smi dmon -s u -c 30                              # 30 samples of utilization
# or:
watch -n 1 nvidia-smi
```

The `enc` and `dec` columns from `nvidia-smi dmon -s u` correspond to NVENC (encode) and NVDEC (decode). Both should move above zero during a transcode.

### Common NVIDIA failures

- `could not select device driver "" with capabilities: [[gpu]]`: toolkit not configured. Re-run `sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker`.
- `Failed to initialise NVENC`: driver too old for the codec. `nvidia-smi` shows the driver version; cross-reference against the [NVIDIA Video Codec SDK support matrix](https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix).
- `No NVIDIA GPU found` inside container despite `nvidia-smi` working on host: `deploy.resources.reservations.devices` block missing from Jellyfin's service. Run `arrstack update`.
- Consumer GeForce cards have a concurrent NVENC session limit (typically 3 or 5). Hitting the cap makes new sessions fall back to CPU.

---

## Is the transcode actually using the GPU?

This is the question that matters. Three ways to confirm, in order of certainty:

1. **ffmpeg command line**. Inside the container:
   ```bash
   docker exec arrstack-jellyfin-1 ps -ef | grep -v grep | grep ffmpeg
   ```
   Intel/AMD wants `-hwaccel vaapi`. NVIDIA wants `-hwaccel cuda` or `-hwaccel nvdec` and a `-c:v h264_nvenc` (or `hevc_nvenc`) somewhere after the `-i`. CPU transcode would show `libx264` / `libx265` with no hwaccel flag.

2. **Jellyfin dashboard**. Dashboard -> Playback -> active streams. Each stream row lists the encoder used (e.g. `h264_nvenc` or `h264_vaapi`). If it says `libx264`, the GPU is not involved.

3. **GPU utilization from the host** while the stream runs:
   - Intel: `sudo intel_gpu_top` (Video engine > 0)
   - AMD: `sudo radeontop` (EE/VGT movement)
   - NVIDIA: `nvidia-smi dmon -s u -c 10` (enc/dec > 0)

If ffmpeg shows the hwaccel flag but GPU utilization stays at zero, driver userspace is falling back silently. Check the Jellyfin ffmpeg log for a `Failed to initialise` line:

```bash
docker exec arrstack-jellyfin-1 \
  tail -n 200 /config/log/FFmpeg.Transcode-$(date +%Y-%m-%d).log
```

---

## When to just use CPU

Hardware transcoding is not always worth the debugging effort:

- Direct Play covers most cases if your clients support the source codec. Match client capabilities instead of forcing transcode.
- A modern CPU can comfortably 1080p-transcode one or two streams with `libx264 veryfast`. The GPU path pays off at 3+ concurrent streams, 4K sources, or tone-mapping HDR.
- On a laptop / mini-PC with a single iGPU, GPU transcoding warms the entire package and can throttle other services.

Set `gpu.vendor: "none"` in state and run `arrstack install --resume` to opt out cleanly.
