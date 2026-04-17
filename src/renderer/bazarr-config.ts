import { renderFile } from "./engine.js";

export interface BazarrConfigOptions {
  username: string;
  bcryptPassword: string;
  sonarrApiKey: string;
  radarrApiKey: string;
}

export function renderBazarrConfig(opts: BazarrConfigOptions): string {
  return renderFile("bazarr-config.yaml.hbs", { ...opts });
}
