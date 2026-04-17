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

  return lines.join("\n") + "\n";
}
