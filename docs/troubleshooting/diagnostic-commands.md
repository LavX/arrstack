# Diagnostic commands

A cheat sheet for inspecting a running arrstack install. Every command assumes the default install dir `~/arrstack`. Replace it if you installed elsewhere, and export `INSTALL_DIR` once:

```bash
export INSTALL_DIR=~/arrstack
export COMPOSE="docker compose -f $INSTALL_DIR/docker-compose.yml"
```

---

## The built-in doctor

`arrstack doctor` runs three passes and exits non-zero if anything fails.

```bash
arrstack doctor
arrstack doctor --install-dir /opt/arrstack        # non-default location
```

It checks, in order:
1. **System checks** via `runPreflight`: Docker installed, Docker running, Compose v2 present, disk space, storage-root writability, required ports free.
2. **Container status** from `docker compose ps --format json`: each enabled service must be `running`, health column is reported when available.
3. **HTTP health checks**: `fetch` to `http://localhost:<port><health.path>` on every service whose catalog entry declares `health.type: http`. Any response under 500 counts as up.

If doctor says a service is unreachable, the next two sections are the right follow-up.

---

## Tail a service's logs

```bash
arrstack logs sonarr                   # follow mode, Ctrl+C to stop
arrstack logs jellyfin
arrstack logs bazarr
```

The subcommand is a thin wrapper around `docker compose logs -f <service>`. Grep the last 200 lines without follow:

```bash
$COMPOSE logs --tail 200 jellyseerr | grep -iE 'error|warn'
```

Dump every service's log to a single tarball for bug reports:

```bash
mkdir -p /tmp/arrstack-logs && cd /tmp/arrstack-logs
for svc in $($COMPOSE config --services); do
  $COMPOSE logs --no-color --tail 2000 $svc > $svc.log
done
tar czf ~/arrstack-logs.tar.gz .
```

---

## Inspect containers with docker compose

```bash
$COMPOSE ps                                  # running + exit codes
$COMPOSE ps --format json | jq '.[] | {Service, State, Health}'
$COMPOSE top                                 # processes inside every container
$COMPOSE config --services                   # list all defined services
$COMPOSE config                              # fully-rendered compose file
$COMPOSE events --since 10m                  # recent lifecycle events
```

Find why a container keeps restarting:
```bash
$COMPOSE ps --format json | jq -r '.[] | "\(.Service)\t\(.ExitCode)\t\(.Status)"'
docker inspect arrstack-jellyfin-1 --format '{{.State.Error}}: {{.State.ExitCode}}'
```

---

## Peek inside a running container

Every service mounts its config at the path declared in `src/catalog/services.yaml`. Common recipes:

```bash
# qBittorrent config
docker exec arrstack-qbittorrent-1 cat /config/qBittorrent/qBittorrent.conf

# Sonarr / Radarr / Prowlarr config (XML, contains API key)
docker exec arrstack-sonarr-1    cat /config/config.xml
docker exec arrstack-radarr-1    cat /config/config.xml
docker exec arrstack-prowlarr-1  cat /config/config.xml

# Bazarr+ config (note the double 'config')
docker exec arrstack-bazarr-1 cat /config/config/config.yaml

# Jellyfin system configuration
docker exec arrstack-jellyfin-1 cat /config/config/system.xml

# Jellyseerr settings (JSON)
docker exec arrstack-jellyseerr-1 cat /app/config/settings.json | jq .

# Trailarr
docker exec arrstack-trailarr-1 cat /config/config.json | jq .

# Recyclarr config
docker exec arrstack-recyclarr-1 cat /config/recyclarr.yml

# Caddy fully-rendered config
docker exec arrstack-caddy-1 cat /config/caddy/autosave.json | jq .
```

Drop into a shell when you need to poke around:
```bash
docker exec -it arrstack-sonarr-1 sh
```

---

## Retrieve service API keys

The installer records API keys in `state.json` under `api_keys`, and the underlying services store them in their own config files. Any of these work:

```bash
# From state (single source of truth)
jq -r '.api_keys | to_entries[] | "\(.key)\t\(.value)"' $INSTALL_DIR/state.json

# Per-service, read from the container itself
docker exec arrstack-sonarr-1   sed -n 's#.*<ApiKey>\(.*\)</ApiKey>.*#\1#p' /config/config.xml
docker exec arrstack-radarr-1   sed -n 's#.*<ApiKey>\(.*\)</ApiKey>.*#\1#p' /config/config.xml
docker exec arrstack-prowlarr-1 sed -n 's#.*<ApiKey>\(.*\)</ApiKey>.*#\1#p' /config/config.xml

# Jellyfin API key (first one from the API keys table)
docker exec arrstack-jellyfin-1 sqlite3 /config/data/jellyfin.db \
  "SELECT AccessToken FROM ApiKeys LIMIT 1;"

# Jellyseerr API key
docker exec arrstack-jellyseerr-1 jq -r '.main.apiKey' /app/config/settings.json
```

Service passwords (admin user) are at `$INSTALL_DIR/admin.txt`. Never commit it:

```bash
arrstack show-password
# or read raw:
cat $INSTALL_DIR/admin.txt
```

---

## Query state.json with jq

`state.json` is the installer's source of truth. It is zod-validated on read; corruption is a fatal error.

```bash
STATE=$INSTALL_DIR/state.json
jq .                                   < $STATE    # everything
jq .installer_version                  < $STATE
jq -r .storage_root                    < $STATE
jq -r .install_dir                     < $STATE
jq -r '.services_enabled | join(", ")' < $STATE
jq -r '.admin.username'                < $STATE
jq '.gpu'                              < $STATE
jq '.remote_access'                    < $STATE
jq '{puid, pgid, timezone}'            < $STATE
jq -r '.subtitle_languages | join(",")' < $STATE

# Which extra paths did the user add?
jq -r '.extra_paths[]?'                < $STATE

# Is the install finished?
jq -r 'if .install_completed_at then "done at \(.install_completed_at)" else "incomplete" end' < $STATE
```

Check the schema version before you edit anything:
```bash
jq -r .schema_version < $STATE         # must be 1 for this installer
```

---

## Verify a port is actually listening

`ss` is faster and more accurate than `netstat` on modern Linux. The installer uses it internally.

```bash
sudo ss -tlnp | grep -E ':(8096|8989|7878|6767|5055|9696|8080) '     # every UI port
sudo ss -tlnp sport = :8096                                          # just Jellyfin
sudo ss -tulnp | grep docker-proxy                                   # every Docker-proxied port

# What process owns the port?
sudo ss -lntup 'sport = :8096'
```

If the port is bound to `127.0.0.1:8096` instead of `0.0.0.0:8096`, LAN clients cannot reach it. See `common-errors.md` under "reachable from the Docker host but not from the LAN".

---

## Check Docker itself

```bash
systemctl status docker                         # is the daemon up?
journalctl -u docker -n 200 --no-pager          # last 200 lines from the daemon
journalctl -u docker --since "10 minutes ago"   # recent-only
docker info | grep -iE 'storage|cgroup|runtime' # cgroup driver, storage backend
docker version                                  # client + server versions
docker system df                                # disk usage by images/volumes/cache
```

On systems using `containerd`:
```bash
journalctl -u containerd -n 200 --no-pager
```

If Docker itself is unhealthy, `arrstack doctor`'s first section will fail and everything downstream will be noise.

---

## Network reachability inside the compose network

```bash
# Does Sonarr see Prowlarr by service name?
docker exec arrstack-sonarr-1 wget -qO- http://prowlarr:9696/ping

# Does FlareSolverr answer?
docker exec arrstack-prowlarr-1 wget -qO- http://flaresolverr:8191/health

# DNS from inside the network
docker exec arrstack-sonarr-1 getent hosts prowlarr
```

---

## Disk and volume inspection

```bash
du -sh $INSTALL_DIR/config/*                    # per-service config size
du -sh $(jq -r .storage_root < $INSTALL_DIR/state.json)
docker system df -v                             # per-volume and per-image usage
docker volume ls
docker volume inspect arrstack_caddy_data       # example
```

Prune dead data (does not touch named volumes unless you add `--volumes`):
```bash
docker system prune -f
docker image prune -a -f
```

---

## Quick "is everything OK" one-liner

```bash
arrstack doctor && \
  jq -r '.services_enabled[]' $INSTALL_DIR/state.json | \
  while read s; do
    printf '%-22s' "$s"
    $COMPOSE ps --format json | jq -r --arg s "$s" '.[] | select(.Service==$s) | .State // "missing"'
  done
```
