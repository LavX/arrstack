import { z } from "zod";

export const StateSchema = z.object({
  schema_version: z.literal(1),
  installer_version: z.string(),
  install_dir: z.string(),
  storage_root: z.string(),
  extra_paths: z.array(z.string()).default([]),
  admin: z.object({ username: z.string() }),
  services_enabled: z.array(z.string()),
  gpu: z.object({
    vendor: z.enum(["intel", "amd", "nvidia", "none"]),
    device_name: z.string().optional(),
    render_gid: z.number().optional(),
    video_gid: z.number().optional(),
  }),
  remote_access: z.object({
    mode: z.enum(["none", "duckdns", "cloudflare"]),
    domain: z.string().optional(),
    token: z.string().optional(),
  }),
  local_dns: z.object({
    enabled: z.boolean(),
    tld: z.string(),
    // When true (default), install the dnsmasq container so hostnames
    // resolve LAN-wide. When false, Caddy still serves vhosts on :80 but
    // clients need their own /etc/hosts entries.
    install_dnsmasq: z.boolean().default(true),
  }),
  vpn: z.object({
    enabled: z.boolean(),
    // VPN_SERVICE_PROVIDER for gluetun: "mullvad" | "protonvpn" | "custom" | etc.
    // When vpn.enabled is false, this is omitted. When gluetun is selected but
    // no real provider was chosen yet, "custom" is a safe placeholder.
    provider: z.string().optional(),
    // VPN protocol. Only wireguard is wired end-to-end in the wizard today;
    // openvpn support would need user/password fields.
    type: z.enum(["wireguard", "openvpn"]).optional(),
    // WireGuard credentials. For provider-based flows (mullvad, protonvpn)
    // the server key/endpoint comes from gluetun's built-in server list, so
    // only private_key + addresses are required.
    private_key: z.string().optional(),
    addresses: z.string().optional(),
    // Optional server selection hint (e.g. "Switzerland"). Mapped to
    // SERVER_COUNTRIES when non-empty.
    countries: z.string().optional(),
    // Custom-provider-only fields. When provider === "custom" the user
    // provides the full server tuple since gluetun has no built-in data.
    endpoint_ip: z.string().optional(),
    endpoint_port: z.number().optional(),
    server_public_key: z.string().optional(),
  }),
  timezone: z.string(),
  puid: z.number(),
  pgid: z.number(),
  // ISO 639-1 codes (e.g. "en", "hu"). Bazarr seeds a default language profile
  // from this list. English-only is the safest out-of-the-box default.
  subtitle_languages: z.array(z.string().length(2)).default(["en"]),
  api_keys: z.record(z.string(), z.string()),
  install_started_at: z.string().datetime().optional(),
  install_completed_at: z.string().datetime().optional(),
  last_updated_at: z.string().datetime().optional(),
});

export type State = z.infer<typeof StateSchema>;
