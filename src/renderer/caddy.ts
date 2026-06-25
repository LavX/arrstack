import type { Service } from "../catalog/schema.js";
import { renderFile } from "./engine.js";

export type CaddyMode = "none" | "cloudflare" | "duckdns";

export interface CaddyOptions {
  mode: CaddyMode;
  domain?: string;
  // Hostname-based LAN access. When enabled and mode is "none", Caddy serves
  // http://{id}.{tld} for every service so users can resolve hostnames via
  // dnsmasq OR entries in their own /etc/hosts file on the client side.
  localDns?: {
    enabled: boolean;
    tld: string;
  };
  // When VPN is on, qBittorrent shares gluetun's netns and has no container
  // name of its own, so Caddy must proxy its vhost to gluetun instead.
  vpn?: { enabled: boolean };
}

interface CaddyServiceEntry {
  id: string;
  port: number;
  // Docker network host Caddy reverse-proxies to. Usually the same as `id`;
  // becomes "gluetun" for qBittorrent when VPN routing is on.
  upstream: string;
}

interface CaddyContext {
  mode: CaddyMode;
  domain: string;
  localDnsEnabled: boolean;
  localDnsTld: string;
  services: CaddyServiceEntry[];
}

export function buildCaddyContext(services: Service[], opts: CaddyOptions): CaddyContext {
  const vpnEnabled = opts.vpn?.enabled ?? false;
  const entries: CaddyServiceEntry[] = services
    .filter((svc) => svc.adminPort !== undefined)
    .map((svc) => ({
      id: svc.id,
      port: svc.adminPort as number,
      upstream: vpnEnabled && svc.id === "qbittorrent" ? "gluetun" : svc.id,
    }));

  return {
    mode: opts.mode,
    domain: opts.domain ?? "",
    localDnsEnabled: opts.localDns?.enabled ?? false,
    localDnsTld: opts.localDns?.tld ?? "",
    services: entries,
  };
}

export function renderCaddyfile(services: Service[], opts: CaddyOptions): string {
  const context = buildCaddyContext(services, opts);
  return renderFile("Caddyfile.hbs", context as unknown as Record<string, unknown>);
}
