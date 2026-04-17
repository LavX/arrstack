# 04. Remote access

Three ways to reach your stack from outside the house: LAN only (safest, no public exposure), DuckDNS (free, requires a port forward), or Cloudflare (your own domain on Cloudflare DNS, wildcard Let's Encrypt via DNS-01). This page shows concrete setup for each, plus how the LAN hostname sub-modes (dnsmasq vs hosts-file vs none) work.

## TL;DR by mode

| Mode        | What you open to the internet | DNS requirement              | TLS                       | Good for |
|-------------|-------------------------------|------------------------------|---------------------------|----------|
| LAN         | Nothing                       | None                         | None (plain HTTP)         | Home use only |
| DuckDNS     | Ports 80, 443                 | Free subdomain               | Let's Encrypt DNS-01 via the DuckDNS plugin | Remote access without owning a domain |
| Cloudflare  | Ports 80, 443                 | Your domain on Cloudflare    | Wildcard Let's Encrypt DNS-01 via the Cloudflare plugin | Custom domain, one cert for every subdomain |

Caddy is the only process that takes inbound internet traffic in every mode. The arr services stay on the internal docker bridge.

> **Caddy plugin note**: both remote-access modes use DNS-01 challenges (`tls { dns cloudflare ... }` or `tls { dns duckdns ... }` in the rendered Caddyfile), which need DNS-provider plugins baked into the Caddy binary. The default `caddy:latest` image ships neither. To use DuckDNS or Cloudflare mode, swap the Caddy image for a build that carries the right plugin, for example `xcaddy build --with github.com/caddy-dns/cloudflare --with github.com/caddy-dns/duckdns`. LAN mode works on the stock image.

## LAN mode

The default and safest. Caddy binds to your LAN IP, nothing is exposed outside your router.

Pick this if you only watch from devices inside your network or via your own VPN.

```bash
# Your LAN IP, write it down
hostname -I | awk '{print $1}'
```

Direct access works on port-based URLs: `http://192.168.1.42:8096` for Jellyfin, `http://192.168.1.42:8989` for Sonarr, and so on.

### LAN hostname sub-modes

If you want names instead of `IP:port`, pick one of the three during the wizard:

| Sub-mode     | How names resolve | Setup effort |
|--------------|-------------------|--------------|
| None         | You use `IP:port` | Zero |
| hosts-file   | Each client edits its own `/etc/hosts` | Manual per device |
| dnsmasq      | arrstack ships a dnsmasq container, you point your router or device DNS at it | One-time router config |

With hostnames on, Caddy generates vhosts like:

```
sonarr.arr.lan     -> http://sonarr:8989
radarr.arr.lan     -> http://radarr:7878
jellyfin.arr.lan   -> http://jellyfin:8096
jellyseerr.arr.lan -> http://jellyseerr:5055
```

### dnsmasq sub-mode

The installer runs dnsmasq on port 53. Two ways to use it:

**Router-wide (best):** In your router admin, set the primary DNS server to your stack host's LAN IP. Every device on the LAN resolves `*.arr.lan` automatically.

**Per-device:** On a Linux client, `sudo resolvectl dns wlp0 192.168.1.42`. On macOS, System Settings, Network, Advanced, DNS. On iPhone, per-Wi-Fi DNS override.

Verify:

```bash
dig @192.168.1.42 sonarr.arr.lan +short
# Should return your stack host's LAN IP
```

### hosts-file sub-mode

Append to `/etc/hosts` on each client:

```
192.168.1.42 sonarr.arr.lan radarr.arr.lan jellyfin.arr.lan jellyseerr.arr.lan
192.168.1.42 prowlarr.arr.lan bazarr.arr.lan qbit.arr.lan trailarr.arr.lan
```

Annoying on phones. Use dnsmasq if you have more than a laptop.

## DuckDNS mode

Free dynamic DNS. You register a `you.duckdns.org` subdomain, arrstack runs a companion updater that pushes your public IP to DuckDNS on every change, and Caddy issues a Let's Encrypt cert via the DuckDNS DNS-01 plugin.

### Setup

1. Go to https://www.duckdns.org and sign in with GitHub, Google, or Reddit.
2. Pick a subdomain, for example `myarr`. Write down the token shown at the top of the page.
3. Run the wizard and pick DuckDNS mode. Enter:

| Field      | Example                                  |
|------------|------------------------------------------|
| Subdomain  | `myarr`                                  |
| Token      | `a1b2c3d4-e5f6-7890-abcd-ef1234567890`   |

4. Forward ports 80 and 443 on your router to the stack host. See the port forwarding section below.

After the wizard, open `https://myarr.duckdns.org` and you should hit the Jellyfin login. Subdomain routing:

```
myarr.duckdns.org                -> Jellyfin
sonarr.myarr.duckdns.org         -> Sonarr (if you enabled sub-subdomains)
```

Under the hood the rendered Caddyfile carries one block per service:

```caddyfile
sonarr.myarr.duckdns.org {
    tls {
        dns duckdns {$DUCKDNS_TOKEN}
    }
    reverse_proxy sonarr:8989
}
```

Caddy solves the DNS-01 challenge by creating a TXT record on DuckDNS via the plugin, which is why the `caddy-dns/duckdns` plugin needs to be baked into the Caddy image. See the plugin note at the top of this page.

## Cloudflare mode

Best option if you own a domain. You bring the domain, Cloudflare handles DNS, Caddy obtains a wildcard Let's Encrypt cert via DNS-01 challenge. No Cloudflare Tunnel, no cloudflared daemon. Ports 80 and 443 are open on your router like any normal self-hosted setup, just with a better cert story.

Under the hood, the generated Caddyfile carries a block like this for each vhost:

```caddyfile
*.arr.yourdomain.com {
    tls {
        dns cloudflare {$CF_API_TOKEN}
    }
    # routes to each service...
}
```

Caddy uses your Cloudflare API token to solve the DNS-01 challenge on `_acme-challenge.*.arr.yourdomain.com`, and Let's Encrypt issues a wildcard cert. One cert covers every service subdomain.

### Prereqs

- A domain you own
- The domain's nameservers pointed to Cloudflare (Full or Full Strict SSL mode in the CF dashboard)
- Ability to forward ports 80 and 443 on your router

### Make a scoped API token

Create a token at https://dash.cloudflare.com/profile/api-tokens. Use the Edit zone DNS template, scoped to your single zone. The token only needs to edit DNS records on the one zone. Do not use your global API key.

| Permission   | Access  | Resource                                |
|--------------|---------|-----------------------------------------|
| Zone.DNS     | Edit    | Include, specific zone `yourdomain.com` |
| Zone.Zone    | Read    | Include, specific zone `yourdomain.com` |

### Wizard fields

| Field            | Value |
|------------------|-------|
| Domain           | `arr.yourdomain.com` (the base domain Caddy appends each service ID to: `sonarr.arr.yourdomain.com`, `jellyfin.arr.yourdomain.com`, etc.) |
| CF API token     | the scoped token you just made |

arrstack writes the token to `~/arrstack/config/caddy/.env` as `CF_API_TOKEN=...` (mode 0o600) and wires it into the Caddy container. Caddy never sends the token anywhere except Cloudflare's API.

### First-boot behavior

On the first Caddy start after wizard finish:

1. Caddy reads the CF token from its env file.
2. Caddy asks Let's Encrypt for a wildcard cert on `*.arr.yourdomain.com`.
3. Let's Encrypt issues a DNS-01 challenge.
4. Caddy creates the `_acme-challenge` TXT record on Cloudflare via API, waits for propagation, and signals ACME ready.
5. Let's Encrypt verifies and issues. Caddy removes the TXT record.
6. You hit `https://sonarr.arr.yourdomain.com` and see a valid cert.

First issuance takes 30 to 120 seconds. Renewals are automatic, Caddy refreshes about 30 days before expiry.

### What about Cloudflare Tunnel?

Not shipped today. The installer does not run cloudflared, does not create a tunnel, and does not require CGNAT-bypass features. Tunnel support is on the roadmap. If you need tunnel-only (no inbound ports at your router), run cloudflared yourself on the host and point it at the Caddy container, then pick LAN mode in the wizard and bind Caddy to 127.0.0.1.

## Port forwarding guidance

If you picked DuckDNS or Cloudflare, your router needs forwards. Every router UI differs, the shape is always:

| External port | Protocol | Internal IP        | Internal port |
|---------------|----------|--------------------|---------------|
| 80            | TCP      | your stack host IP | 80            |
| 443           | TCP      | your stack host IP | 443           |

Do not forward the service ports directly (8096, 8989, etc.). Caddy is the only process that should take traffic from the internet.

Verify from outside your LAN (phone on cellular works):

```bash
curl -I https://myarr.duckdns.org
# Expect: HTTP/2 200 or 302 to /web/index.html
```

## Security posture notes

| Do                                              | Do not |
|-------------------------------------------------|--------|
| Keep the arr services behind Caddy auth         | Expose Sonarr/Radarr directly on a public port |
| Use a strong admin password                     | Reuse your email password |
| Add Cloudflare Access in front of admin tools   | Assume "only I know the URL" is security |
| Update with `arrstack update` monthly           | Leave 6-month-old images exposed to the internet |

This is self-hosted media for your household. Treat it as such. If you need hardened posture beyond that, this is not the tool.

## Switching modes later

Rerun the wizard:

```bash
arrstack install --resume
```

Skip ahead to the Remote access screen, pick the new mode, finish. Caddy is regenerated and restarted, DNS records are updated. Your media and configs are untouched.

## Next steps

- [02. First run](02-first-run.md): verify the admin URLs are reachable under whichever mode you picked.
- [06. VPN (gluetun + WireGuard)](06-vpn.md): add an outbound tunnel for qBittorrent independent of how you expose the stack inbound.
- [09. Updating](09-updating.md): keep Caddy and your cert chain current.
