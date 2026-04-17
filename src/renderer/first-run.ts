import type { Service } from "../catalog/schema.js";
import { renderFile } from "./engine.js";

export interface FirstRunOptions {
  services: Service[];
  hostIp: string;
  adminUsername: string;
  localDns?: {
    enabled: boolean;
    tld: string;
  };
  dnsmasqInstalled: boolean;
}

interface ServiceEntry {
  name: string;
  id: string;
  port: number;
}

export function renderFirstRun(opts: FirstRunOptions): string {
  const entries: ServiceEntry[] = opts.services
    .filter((svc) => svc.adminPort !== undefined)
    .map((svc) => ({ name: svc.name, id: svc.id, port: svc.adminPort as number }));

  const hostnamesEnabled = opts.localDns?.enabled ?? false;
  const tld = opts.localDns?.tld ?? "";

  // Single string users can paste into their /etc/hosts when dnsmasq
  // isn't installed or they're on a client that doesn't use it for DNS.
  const hostsLine = hostnamesEnabled
    ? `${opts.hostIp} ${entries.map((e) => `${e.id}.${tld}`).join(" ")}`
    : "";

  return renderFile("FIRST-RUN.md.hbs", {
    services: entries,
    hostIp: opts.hostIp,
    adminUsername: opts.adminUsername,
    hostnamesEnabled,
    tld,
    hostsLine,
    dnsmasqInstalled: opts.dnsmasqInstalled,
  });
}
