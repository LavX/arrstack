# 06. VPN (gluetun + WireGuard)

arrstack routes **qBittorrent only** through a VPN by default. Prowlarr, Sonarr, Radarr, and the rest use your normal internet connection. This page covers enabling gluetun, pasting a WireGuard config from Mullvad or Proton (or any provider via the custom path), and understanding the kill-switch behavior so your torrent traffic never leaks.

## TL;DR

```bash
# 1. Enable in wizard
arrstack install --resume   # Services screen -> VPN: on

# 2. Paste wireguard config when asked, or drop one in:
#    ~/arrstack/config/gluetun/wireguard/wg0.conf

# 3. Verify qBittorrent goes out the VPN
docker exec qbittorrent curl -s ifconfig.me
# Should show the VPN's exit IP, NOT your ISP IP
```

## What routes where

| Service       | Network              | Outbound IP |
|---------------|----------------------|-------------|
| qBittorrent   | `network_mode: service:gluetun` | VPN exit |
| gluetun       | host bridge + wireguard tunnel  | VPN exit |
| Sonarr        | stack bridge                    | Your ISP |
| Radarr        | stack bridge                    | Your ISP |
| Prowlarr      | stack bridge                    | Your ISP |
| Jellyfin      | stack bridge                    | Your ISP |
| Everything else | stack bridge                  | Your ISP |

qBittorrent has no IP of its own, it uses gluetun's network namespace. If gluetun is down, qBittorrent has no network at all. That is the kill switch.

## Kill-switch behavior

gluetun sets strict firewall rules: the only egress allowed is through the WireGuard tunnel. If the tunnel drops, packets are rejected. qBittorrent, living inside the same netns, cannot talk to anything.

You will see this in practice when:

- VPN credentials are wrong: qBittorrent loads its WebUI (host-forwarded port) but every torrent shows 0 peers.
- You swap providers: brief dead period while the new config comes up.
- Upstream provider outage: downloads stall, resume automatically when the tunnel reconnects.

The WebUI on port 8080 is forwarded by gluetun, not qBittorrent directly. That is why the UI stays reachable even when the tunnel is down.

## Enabling in the wizard

```bash
arrstack install --resume
```

On the VPN screen:

| Field                | Options |
|----------------------|---------|
| Enable gluetun       | on / off |
| Provider             | `mullvad`, `protonvpn`, `custom` |
| Protocol             | `wireguard` (only protocol wired end-to-end today) |
| Private key          | `WIREGUARD_PRIVATE_KEY` from your provider config |
| Addresses            | Tunnel IP/CIDR, e.g. `10.64.222.21/32` |
| Countries (optional) | Gluetun server-selection hint, e.g. `Switzerland, Sweden` |

For `custom`, arrstack also asks for the server endpoint IP, endpoint port, and the peer's public key so gluetun has the full tuple (providers such as AirVPN and PrivateInternetAccess go through this path, since gluetun has no built-in server list for them when exposed via the custom flow here).

## Provider configs

### Mullvad

1. Sign in at https://mullvad.net/account.
2. WireGuard configuration, generate key, pick a city.
3. Download the `.conf` file. It looks like:

```ini
[Interface]
PrivateKey = AAAA...=
Address = 10.66.123.45/32
DNS = 10.64.0.1

[Peer]
PublicKey = BBBB...=
AllowedIPs = 0.0.0.0/0,::/0
Endpoint = 185.65.134.66:51820
```

4. In the wizard, pick provider `mullvad`, paste the whole file. arrstack extracts the private key, address, and endpoint.

### ProtonVPN

1. Sign in at https://account.protonvpn.com.
2. Downloads, WireGuard configuration, create.
3. Device name: `arrstack`. Enable NAT-PMP for port forwarding.
4. Pick a server with the P2P icon. Download the `.conf`.
5. Paste in the wizard under provider `protonvpn`.

ProtonVPN's free tier does not allow P2P. You need Plus or higher. Port forwarding works but requires `natpmpc` inside the container, which gluetun handles.

### AirVPN and other providers (use `custom`)

AirVPN, PrivateInternetAccess, and any other WireGuard provider that hands you a `.conf` file go through the `custom` path. Gluetun has a built-in server list for Mullvad and Proton only; for everything else you feed it the endpoint yourself.

1. Sign in at your provider (for AirVPN: https://airvpn.org/client-area/).
2. Generate a WireGuard config and download the `.conf`.
3. In the wizard, pick provider `custom` and fill in:
   - Private key (from `[Interface] PrivateKey`)
   - Addresses (from `[Interface] Address`)
   - Endpoint IP and port (from `[Peer] Endpoint`, split on `:`)
   - Server public key (from `[Peer] PublicKey`)

arrstack does not call the provider's API in this mode; your tuple is the source of truth.

## Where the config lives

```
~/arrstack/config/gluetun/
  wireguard/
    wg0.conf            <- your config, mode 0o600
  servers.json          <- cached from gluetun
  gluetun.log           <- runtime logs
```

Edit `wg0.conf` and restart gluetun to switch servers without rerunning the wizard:

```bash
docker compose -f ~/arrstack/docker-compose.yml restart gluetun
```

qBittorrent restarts automatically because it depends on gluetun.

## Verification

Run these after gluetun reports healthy.

```bash
# 1. qBittorrent's outbound IP should be the VPN exit
docker exec qbittorrent curl -s ifconfig.me

# 2. Sonarr's outbound IP should be your ISP
docker exec sonarr curl -s ifconfig.me

# 3. DNS leak check
docker exec qbittorrent sh -c 'nslookup whoami.akamai.net'
```

Hit a torrent tracker's IP-leak checker from qBittorrent itself. Some providers offer a magnet link you can grab (AirVPN's "What is my IP" for example) that reports the exit IP in the tracker message.

## Port forwarding for qBittorrent

Some providers (ProtonVPN Plus, AirVPN, PrivateInternetAccess) support inbound port forwarding through their VPN, which boosts torrent connectability.

gluetun exposes the forwarded port in a file inside the container:

```
/tmp/gluetun/forwarded_port
```

qBittorrent's startup script reads that file and sets the listen port on each gluetun reconnect. If your seed ratios are low after VPN setup, verify the forwarded port is set:

```bash
docker exec gluetun cat /tmp/gluetun/forwarded_port
docker exec qbittorrent sh -c 'curl -s http://localhost:8080/api/v2/app/preferences | jq .listen_port'
```

The two numbers should match.

## Troubleshooting

| Symptom                                  | Likely cause | Fix |
|------------------------------------------|--------------|-----|
| gluetun container stuck in "restarting"  | Bad WireGuard config | `arrstack logs gluetun`, look for "invalid private key" or "endpoint unreachable" |
| qBittorrent WebUI unreachable            | Port not forwarded by gluetun | Check `docker compose ... config | grep 8080` maps host port to gluetun |
| All torrents show 0 peers                | Kill switch active, no tunnel | Inspect gluetun logs, probably DNS or endpoint issue |
| Downloads slow after VPN                 | Endpoint congested | Pick a nearer city in the provider's panel, regen config |
| Can't reach qBittorrent by LAN hostname  | Caddy not in gluetun's netns, needs direct proxy | Use `qbit.arr.lan` through Caddy, which proxies to gluetun's host port |

## Turning VPN off

Rerun the wizard, VPN off, finish. qBittorrent gets its own network back, gluetun container is removed. Existing torrents resume on your regular connection, which may or may not be what you want. Check your seeding preferences before disabling.

## Next steps

- [04. Remote access](04-remote-access.md): inbound reachability is independent of gluetun's outbound tunnel.
- [07. Providers setup](07-providers-setup.md): private tracker API keys to pair with a VPN-routed qBittorrent.
- [09. Updating](09-updating.md): gluetun images ship frequent fixes, keep it current.
