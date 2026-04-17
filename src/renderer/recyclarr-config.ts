import { renderFile } from "./engine.js";

export interface RecyclarrConfigOptions {
  sonarrApiKey: string;
  radarrApiKey: string;
}

export function renderRecyclarrConfig(opts: RecyclarrConfigOptions): string {
  return renderFile("recyclarr.yml.hbs", { ...opts });
}
