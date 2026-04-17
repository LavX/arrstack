export interface EnvRendererOptions {
  puid: number;
  pgid: number;
  timezone: string;
  installDir: string;
  storageRoot: string;
  adminUsername: string;
  adminPassword: string;
  apiKeys: Record<string, string>;
  cfApiToken?: string;
  duckdnsToken?: string;
  // Shared between bazarr and ai-subtitle-translator for encrypting OpenRouter
  // keys in transit per the Bazarr+ protocol. 32 bytes hex.
  encryptionKey?: string;
  // OpenRouter API key the user pastes during install. Empty by default; the
  // user can set it later in Bazarr+ Settings > AI Translator.
  openrouterApiKey?: string;
}

export function renderEnvFile(opts: EnvRendererOptions): string {
  const lines: string[] = [
    `PUID=${opts.puid}`,
    `PGID=${opts.pgid}`,
    `TZ=${opts.timezone}`,
    `INSTALL_DIR=${opts.installDir}`,
    `STORAGE_ROOT=${opts.storageRoot}`,
    `ADMIN_USERNAME=${opts.adminUsername}`,
    `ADMIN_PASSWORD=${opts.adminPassword}`,
  ];

  for (const [serviceId, apiKey] of Object.entries(opts.apiKeys)) {
    const envKey = `${serviceId.toUpperCase()}__AUTH__APIKEY`;
    lines.push(`${envKey}=${apiKey}`);
  }

  if (opts.cfApiToken) {
    lines.push(`CF_API_TOKEN=${opts.cfApiToken}`);
  }

  if (opts.duckdnsToken) {
    lines.push(`DUCKDNS_TOKEN=${opts.duckdnsToken}`);
  }

  if (opts.encryptionKey) {
    lines.push(`ENCRYPTION_KEY=${opts.encryptionKey}`);
  }

  // Always write the key (empty by default) so docker-compose variable
  // substitution never fails with "required variable not set".
  lines.push(`OPENROUTER_API_KEY=${opts.openrouterApiKey ?? ""}`);

  return lines.join("\n") + "\n";
}
