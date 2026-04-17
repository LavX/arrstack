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
}

interface CaddyServiceEntry {
  id: string;
  port: number;
}

interface CaddyContext {
  mode: CaddyMode;
  domain: string;
  localDnsEnabled: boolean;
  localDnsTld: string;
  services: CaddyServiceEntry[];
}

export function buildCaddyContext(services: Service[], opts: CaddyOptions): CaddyContext {
  const entries: CaddyServiceEntry[] = services
    .filter((svc) => svc.adminPort !== undefined)
    .map((svc) => ({ id: svc.id, port: svc.adminPort as number }));

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
