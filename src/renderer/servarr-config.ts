import { renderFile } from "./engine.js";

export interface ServarrConfigOptions {
  apiKey: string;
}

export function renderServarrConfig(opts: ServarrConfigOptions): string {
  return renderFile("servarr-config.xml.hbs", { apiKey: opts.apiKey });
}
