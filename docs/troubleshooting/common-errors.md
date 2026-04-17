# Common errors

Every entry gives a **Symptom** (what you see), **Cause** (why it happens), **Fix** (exact commands or config change), and **Prevention** where applicable. If your problem is not here, run `arrstack doctor` and check the per-service FAQ before filing an issue.

---

### EACCES creating /srv/arrstack or /opt/arrstack

**Symptom.**
```
Cannot create /srv/arrstack/torrents/tv: permission denied.
Pick a path your user can write to (e.g. under $HOME), or run the
installer with sudo if you want /srv/arrstack.
```
**Cause.** The wizard was pointed at a system directory (`/srv`, `/opt`, `/mnt/...`) that your non-root user cannot write to. `createStorageLayout` refuses to fall back silently.
**Fix.** Pick a path under your home dir, or run with elevated privileges:
```bash
arrstack install --fresh                              # pick ~/arrstack/data
sudo -E arrstack install --install-dir /opt/arrstack  # or run elevated
```
**Prevention.** Default to `~/arrstack/data`. System paths need `sudo` plus `chown -R $USER:$USER` first.

---

### manifest for arrstack-caddy:v1 not found

**Symptom.** `Error response from daemon: manifest for arrstack-caddy:v1 not found: manifest unknown`.
**Cause.** Old compose file pinned a private image tag that was never published. The installer now uses upstream `caddy:latest`.
**Fix.** `arrstack update` rewrites `docker-compose.yml` from the catalog.
**Prevention.** Do not hand-edit `docker-compose.yml`. Re-run `arrstack update` after every CLI upgrade.

---

### Jellyseerr EACCES on /app/config/logs

**Symptom.** `jellyseerr | Error: EACCES: permission denied, mkdir '/app/config/logs'` followed by exit 1.
**Cause.** The bind-mounted config dir was created as root (or not pre-created), and the container runs as `PUID:PGID`.
**Fix.**
```bash
cd ~/arrstack
sudo chown -R $(id -u):$(id -g) config/jellyseerr
docker compose restart jellyseerr
```
**Prevention.** The installer pre-creates `${installDir}/config/${svc}` and `chown`s to `PUID:PGID` before first `compose up`. If you moved the install dir manually, run `arrstack install --resume` to repair.

---

### Jellyfin /Startup/User returns 500 on first run

**Symptom.** `curl http://localhost:8096/Startup/User` returns HTTP 500 during install, or the TUI hangs on "Configuring Jellyfin".
**Cause.** Jellyfin answers on :8096 before the startup wizard is ready. The installer polls `/System/Info/Public` until it returns 200.
**Fix.** If the 60-second poll times out:
```bash
arrstack logs jellyfin                                # look for "Startup complete"
docker compose -f ~/arrstack/docker-compose.yml restart jellyfin
arrstack install --resume
```
**Prevention.** Do not interrupt the installer during Jellyfin configuration.

---

### Jellyfin admin user created but not administrator

**Symptom.** You log in as the admin user but Dashboard is missing, and `GET /Users/{id}` shows `"IsAdministrator": false`.
**Cause.** The Jellyfin wizard creates the user without setting admin flags. A follow-up `POST /Users/{id}/Policy` is required.
**Fix.**
```bash
arrstack update
# or manually:
curl -X POST http://localhost:8096/Users/$USER_ID/Policy \
  -H "X-Emby-Token: $API_KEY" -H "Content-Type: application/json" \
  -d '{"IsAdministrator":true,"EnableAllFolders":true}'
```

---

### Jellyseerr says NO_ADMIN_USER on /auth/jellyfin

**Symptom.** Bootstrap fails with `{"message":"NO_ADMIN_USER"}` on `POST /auth/jellyfin`.
**Cause.** Jellyseerr v2 requires `serverType: 2` in the body to mean Jellyfin (not Emby).
**Fix.** `arrstack update`. If you patched the call yourself, include:
```json
{ "username": "...", "password": "...", "hostname": "http://jellyfin:8096", "serverType": 2 }
```

---

### Jellyseerr /setup still appears after bootstrap

**Symptom.** Auth succeeds but `http://<host>:5055` redirects to `/setup`.
**Cause.** Setup requires all four bootstrap steps: auth, library sync, library enable, `POST /settings/initialize`.
**Fix.**
```bash
arrstack install --resume
# if still failing, start Jellyseerr from scratch:
docker compose -f ~/arrstack/docker-compose.yml stop jellyseerr
sudo rm -rf ~/arrstack/config/jellyseerr
arrstack install --resume
```

---

### Jellyseerr "hostname already configured" on re-bootstrap

**Symptom.** `POST /auth/jellyfin` returns HTTP 500 with `"hostname already configured"` after a successful first run.
**Cause.** The hostname can only be set once. Subsequent logins must omit it.
**Fix.** Already handled by the installer. If you script this yourself, drop `hostname` on any call after the initial bootstrap.

---

### Prowlarr indexer POST returns 400

**Symptom.** `POST /api/v1/indexer` fails with HTTP 400 complaining about missing fields.
**Cause.** Prowlarr requires `appProfileId`, `priority`, and `enable` on create, even though the web UI fills them in for you.
**Fix.** Every indexer body must include:
```json
{ "appProfileId": 1, "priority": 25, "enable": true, "...": "..." }
```
See `src/wiring/prowlarr-indexers.ts` for the full shape.

---

### Prowlarr "URL invalid" when adding Sonarr/Radarr as an app

**Symptom.** `POST /api/v1/applications` returns `"Prowlarr URL invalid"`.
**Cause.** Prowlarr validates its own URL by calling back from inside the container. `http://localhost:9696` resolves to the Sonarr container, not Prowlarr.
**Fix.** Use docker service names: `"prowlarrUrl": "http://prowlarr:9696", "baseUrl": "http://sonarr:8989"`.

---

### Prowlarr syncs 0 indexers to Sonarr/Radarr

**Symptom.** Sonarr shows no indexers even though Prowlarr lists them and the app sync succeeded.
**Cause.** Prowlarr only pushes indexers that existed at the time the app was added, and the FlareSolverr tag must be set at create time.
**Fix.** Order matters: create FlareSolverr proxy, then apps, then indexers (with FlareSolverr tag where needed). `arrstack install --resume` runs them in this order.
**Prevention.** If you add an indexer by hand, click "Sync App Indexers" afterward.

---

### Bazarr+ shows a browser basic-auth dialog instead of the login form

**Symptom.** Opening `http://<host>:6767` pops a native username/password dialog.
**Cause.** `auth.type` defaults to `basic`. Bazarr+ expects `form`.
**Fix.**
```bash
docker compose -f ~/arrstack/docker-compose.yml stop bazarr
sed -i 's/^\([[:space:]]*type:\)[[:space:]]*basic/\1 form/' \
  ~/arrstack/config/bazarr/config/config.yaml
docker compose -f ~/arrstack/docker-compose.yml start bazarr
```
Or: `arrstack install --resume`.

---

### Bazarr+ crash: KeyError 'audio_only_include'

**Symptom.** `bazarr | KeyError: 'audio_only_include'` followed by exit 1.
**Cause.** Language profiles require `audio_exclude`, `audio_only_include`, `hi`, and `forced` on every item.
**Fix.** `arrstack update`. For custom profiles, add the missing keys:
```yaml
items:
  - language: en
    forced: false
    hi: false
    audio_exclude: []
    audio_only_include: []
```

---

### Bazarr+ config edits do not stick

**Symptom.** You edit `config/bazarr/config.yaml` and nothing changes after restart.
**Cause.** The Bazarr+ image reads `/config/config/config.yaml` (double `config`), not `/config/config.yaml`.
**Fix.** Edit `~/arrstack/config/bazarr/config/config.yaml`, then `docker compose restart bazarr`.

---

### Bazarr+ subtitle editor says "Failed to parse subtitle file"

**Symptom.** The editor errors, even though the subtitle downloads and plays fine.
**Cause.** The Bazarr+ frontend uses `crypto.randomUUID()`, which browsers only expose in a secure context (HTTPS or localhost). Plain HTTP on a LAN IP breaks the editor.
**Fix.** Access Bazarr+ via the Caddy HTTPS vhost (e.g. `https://bazarr.arrstack.local`) or `http://localhost:6767` from the Docker host.
**Prevention.** Enable local DNS + Caddy in the wizard so every service has an HTTPS URL.

---

### Trailarr health check fails on port 7879

**Symptom.** `arrstack doctor` reports Trailarr unhealthy; connection refused on :7879.
**Cause.** Trailarr v0.8+ listens on 7889. The 7879 value in older guides is wrong. Health path is `/status`, not `/`.
**Fix.** `arrstack update`. If you hand-edited `docker-compose.yml`, revert to `7889:7889`.

---

### Prowlarr TorrentGalaxy definition returns 500

**Symptom.** `Invalid definition: TorrentGalaxy` in Prowlarr logs; the indexer refuses to save.
**Cause.** The upstream definition was removed. The clone lives at `torrentgalaxyclone`.
**Fix.** Delete the old indexer, add `TorrentGalaxyClone`. `arrstack install --resume` does this automatically.

---

### Recyclarr "include: templates are not supported"

**Symptom.** `recyclarr | Error: 'include' is not a valid key under quality_profiles.`
**Cause.** Recyclarr v8 dropped include-based templating. Profiles must inline `qualities` and `upgrade.until_quality`.
**Fix.** `arrstack update`. If you maintain a custom `recyclarr.yml`, flatten it. See `src/renderer/recyclarr-config.ts` for the shape.

---

### Services reachable from the Docker host but not from the LAN

**Symptom.** `curl http://localhost:8096` works on the server, but `http://<server-ip>:8096` from your laptop times out.
**Cause.** When `remote_access.mode` is `none`, ports bind to `127.0.0.1`. LAN mode binds to `0.0.0.0`.
**Fix.** `arrstack install --fresh` and pick LAN mode. Or hand-edit `docker-compose.yml`, replacing `127.0.0.1:8096` with `0.0.0.0:8096`, then `docker compose up -d`.

---

### Cannot log in to Sonarr / Radarr / Prowlarr: no user exists

**Symptom.** Login rejects everything, and `docker exec sonarr cat /config/config.xml` shows no `<Username>`.
**Cause.** Forms auth was enabled but no user was seeded. Fresh installs seed an admin via `PUT /api/vN/config/host`.
**Fix.** `arrstack install --resume` reseeds. `arrstack show-password` prints the credentials.

---

### docker: permission denied

**Symptom.** `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`.
**Cause.** Your user is not in the `docker` group.
**Fix.**
```bash
sudo usermod -aG docker $USER
newgrp docker                       # or log out and back in
docker ps                           # verify
```

---

### Ports 8096 / 8989 / 7878 / 6767 blocked by firewall

**Symptom.** Services respond from `localhost` but LAN clients hit connection refused or timeouts.
**Cause.** UFW (Debian/Ubuntu) or firewalld (Fedora) blocks the port. The installer does not touch your firewall.
**Fix.**
```bash
# UFW
sudo ufw allow from 192.168.0.0/16 to any port 8096,8989,7878,6767,5055 proto tcp
# firewalld
sudo firewall-cmd --permanent --add-port={8096,8989,7878,6767,5055}/tcp
sudo firewall-cmd --reload
```

---

### SELinux blocks container bind mounts (Fedora)

**Symptom.** Container logs show `Permission denied` on files you just chowned correctly; `ls -Z` shows files missing `container_file_t`.
**Cause.** Docker on SELinux-enforcing systems needs the `:Z` mount flag.
**Fix.** The compose renderer adds `:Z` on Fedora. If you upgraded from an older install: `arrstack update && docker compose -f ~/arrstack/docker-compose.yml up -d --force-recreate`. One-off relabel: `sudo chcon -R -t container_file_t ~/arrstack/config`.

---

### /dev/dri/renderD128 missing on a server kernel

**Symptom.** Wizard says "no render device found" even though `lspci` shows an Intel iGPU.
**Cause.** Headless Debian/Ubuntu server kernels sometimes skip the `i915` module.
**Fix.**
```bash
sudo modprobe i915
echo i915 | sudo tee /etc/modules-load.d/i915.conf
ls -l /dev/dri/                     # renderD128 should appear
```
**Prevention.** Install `linux-generic-hwe` (Ubuntu) or `linux-image-generic` (Debian) on fresh servers.

---

### NVIDIA: no usable GPU detected inside the container

**Symptom.** Jellyfin logs `No NVIDIA GPU found` even though `nvidia-smi` works on the host.
**Cause.** `nvidia-container-toolkit` is not installed or Docker is not configured for it.
**Fix.**
```bash
# Ubuntu/Debian
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```
Then `arrstack update` so the Jellyfin service picks up the GPU reservation block.

---

### Recyclarr sync exits 1 with "config not found"

**Symptom.**
```
recyclarr exited with code 1: No configuration files found at /config/recyclarr.yml
```
The container starts, logs the error, and exits. `arrstack logs recyclarr` keeps reprinting the same line.
**Cause.** The bind mount at `${installDir}/config/recyclarr/` is empty. Either the installer was interrupted before the renderer ran, or someone deleted the directory after install.
**Fix.**
```bash
ls ~/arrstack/config/recyclarr/        # should contain recyclarr.yml
arrstack install --resume              # re-emits the config from state.json
docker compose -f ~/arrstack/docker-compose.yml up -d recyclarr
```
If you want a one-off run without restarting anything:
```bash
docker compose -f ~/arrstack/docker-compose.yml run --rm recyclarr sync
```
**Prevention.** Do not `rm -rf` anything under `~/arrstack/config/`. Use `arrstack uninstall --purge` instead; it regenerates cleanly on the next install.

---

### arrstack doctor reports "docker compose v2 not found" on Debian

**Symptom.**
```
Preflight check failed: docker compose v2 not found on PATH.
Install the docker-compose-plugin package, then rerun arrstack doctor.
```
`docker-compose` (the legacy v1 Python binary) may still exist, but the installer needs `docker compose` (the v2 Go plugin).
**Cause.** Debian's default repositories ship `docker.io` without the compose plugin. The installer calls `docker compose ps --format json`, which is a v2-only flag.
**Fix.**
```bash
# Debian / Ubuntu: install from Docker's repo, not distro repos
curl -fsSL https://download.docker.com/linux/debian/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker compose version                 # should print "Docker Compose version v2.x"
arrstack doctor
```
**Prevention.** Install Docker from Docker's official repo, not from the distro. The `docker.io` package on Debian/Ubuntu lags behind and does not bundle the compose plugin.

---

### UFW blocks port 443 after cloudflare mode is selected

**Symptom.** You picked `cloudflare` in the remote-access step, Caddy starts, `docker ps` shows it listening, but `curl https://sonarr.yourdomain.tld` from outside the LAN times out. Inside the LAN, `curl -k https://<host>` works.
**Cause.** Cloudflare mode runs Caddy on ports 80 and 443 on the host and completes the DNS-01 ACME challenge against Cloudflare's DNS API. It does not use Cloudflare Tunnel. Traffic must still reach your server on 80/443. UFW's default deny-incoming rule drops that traffic.
**Fix.**
```bash
sudo ufw status verbose                # confirm default is deny (incoming)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
sudo ss -tlnp | grep -E ':(80|443) '   # confirm Caddy is bound
```
If your server is behind a router, also forward 80/tcp and 443/tcp to the server's LAN IP.
**Prevention.** The installer prints a firewall reminder after enabling `cloudflare` mode. If you missed it, `arrstack doctor` reports the bind but cannot tell you the packet is being dropped upstream, so UFW/firewalld state is worth checking first when HTTPS fails only from outside the LAN.

---

### ss -tlnp shows nothing on 80/443 because Caddy is not running

**Symptom.**
```
$ sudo ss -tlnp | grep -E ':(80|443) '
$ # empty output
```
But `arrstack doctor` says the install is complete, and `docker compose ps` lists `caddy` as `Exited (1)` or missing entirely.
**Cause.** Caddy failed to start and never bound the ports. Common reasons: another process already owns 80 or 443 on the host (Apache, nginx, systemd `caddy.service`), the Caddyfile volume has wrong ownership, or the custom `xcaddy` image build failed for `duckdns`/`cloudflare` mode.
**Fix.**
```bash
docker compose -f ~/arrstack/docker-compose.yml ps caddy
arrstack logs caddy                                    # read the actual startup error
sudo ss -tlnp sport = :80                              # who owns 80 on the host?
sudo ss -tlnp sport = :443                             # who owns 443?
sudo systemctl stop apache2 nginx caddy 2>/dev/null    # stop competing services
docker compose -f ~/arrstack/docker-compose.yml up -d caddy
sudo ss -tlnp | grep -E ':(80|443) '                   # should now show docker-proxy
```
If the log says `failed to load module "dns.providers.cloudflare"`, the custom image did not build. Run `arrstack update` and watch for the `xcaddy build` step.
**Prevention.** Before enabling remote-access mode, disable any host-level HTTP daemon: `sudo systemctl disable --now apache2 nginx caddy`.

---

## Escalation path

When something is broken, walk this ladder in order. Each rung gives the next rung better information.

1. **`arrstack doctor`**. Starts with preflight, then container status, then HTTP health. It tells you *which layer* is broken: host, container, or app.
2. **`arrstack logs <svc>`**. Once you know the failing service, read its last few hundred lines. Most problems name themselves in the logs.
3. **`docker compose -f ~/arrstack/docker-compose.yml ps`**. Confirm the container is actually `running` and `healthy`. A container in `restarting` or `exited` state will never respond to HTTP, no matter what the app logs say.
4. **Re-read this page.** Search for the exact error string you saw. If it is here, the fix is a copy-paste away.
5. **Open an issue.** If the error is not documented, file one at `github.com/<org>/arrstack-installer/issues/new` with:
   - Distro and version (`cat /etc/os-release`)
   - Docker version (`docker version`)
   - Installer version (`arrstack --version`)
   - Redacted `state.json` (strip `api_keys`, `admin`, `.env`)
   - Output of `arrstack doctor --verbose`
   - Relevant `arrstack logs <svc>` excerpt

Do not skip rungs. Filing an issue before reading logs is the fastest way to get "please attach logs" as the first reply.
