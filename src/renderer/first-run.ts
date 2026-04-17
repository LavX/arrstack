import type { Service } from "../catalog/schema.js";
import { renderFile } from "./engine.js";

export interface FirstRunOptions {
  services: Service[];
  hostIp: string;
  adminUsername: string;
}

interface ServiceEntry {
  name: string;
  port: number;
}

export function renderFirstRun(opts: FirstRunOptions): string {
  const entries: ServiceEntry[] = opts.services
    .filter((svc) => svc.adminPort !== undefined)
    .map((svc) => ({ name: svc.name, port: svc.adminPort as number }));

  return renderFile("FIRST-RUN.md.hbs", {
    services: entries,
    hostIp: opts.hostIp,
    adminUsername: opts.adminUsername,
  });
}
