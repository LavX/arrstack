import type { Service } from "../catalog/schema.js";
import { renderFile } from "./engine.js";

export type CaddyMode = "none" | "cloudflare" | "duckdns";

export interface CaddyOptions {
  mode: CaddyMode;
  domain?: string;
}

interface CaddyServiceEntry {
  id: string;
  port: number;
}

interface CaddyContext {
  mode: CaddyMode;
  domain: string;
  services: CaddyServiceEntry[];
}

export function buildCaddyContext(services: Service[], opts: CaddyOptions): CaddyContext {
  const entries: CaddyServiceEntry[] = services
    .filter((svc) => svc.adminPort !== undefined)
    .map((svc) => ({ id: svc.id, port: svc.adminPort as number }));

  return {
    mode: opts.mode,
    domain: opts.domain ?? "",
    services: entries,
  };
}

export function renderCaddyfile(services: Service[], opts: CaddyOptions): string {
  const context = buildCaddyContext(services, opts);
  return renderFile("Caddyfile.hbs", context as unknown as Record<string, unknown>);
}
