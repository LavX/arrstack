import { renderFile } from "./engine.js";

export interface DnsmasqOptions {
  tld: string;
  hostIp: string;
}

export function renderDnsmasqConf(opts: DnsmasqOptions): string {
  return renderFile("dnsmasq.conf.hbs", { tld: opts.tld, hostIp: opts.hostIp });
}
