import { renderFile } from "./engine.js";

export interface BazarrConfigOptions {
  username: string;
  // Bazarr+ expects "pbkdf2:<salt_hex>:<hash_hex>" (SHA-256, 600k iters).
  // Build it with bazarrPbkdf2Hash() — NOT bcrypt, Bazarr+ doesn't accept it.
  passwordHash: string;
  // Bazarr's own API key (32 hex chars). Separate from the arr apps' API keys.
  bazarrApiKey: string;
  // Flask session signing secret (32 hex chars).
  flaskSecretKey: string;
  sonarrApiKey: string;
  radarrApiKey: string;
}

export function renderBazarrConfig(opts: BazarrConfigOptions): string {
  return renderFile("bazarr-config.yaml.hbs", { ...opts });
}
