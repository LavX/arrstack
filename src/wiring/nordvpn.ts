import { withRetry } from "../lib/retry.js";

// Where users create a NordVPN access token. Surfaced in the wizard hint and the
// VPN docs so people don't have to hunt for it.
export const NORDVPN_TOKEN_URL =
  "https://my.nordaccount.com/dashboard/nordvpn/access-tokens/";

const NORD_CREDENTIALS_URL = "https://api.nordvpn.com/v1/users/services/credentials";

// NordVPN access tokens are 64 hex characters. A WireGuard (NordLynx) private
// key is 44-character base64 ending in '='. We use this to decide whether the
// value the user pasted is a token to derive from, or an already-extracted WG
// key to pass through unchanged (power users who ran the curl themselves).
export function isNordVpnToken(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}

// NordVPN does not expose the WireGuard private key in its dashboard; it is only
// returned by the authenticated credentials endpoint. gluetun needs that key as
// WIREGUARD_PRIVATE_KEY. Users paste their access token (created at
// NORDVPN_TOKEN_URL) and the installer turns it into the WG key, so they never
// have to run curl by hand. HTTP Basic auth is `token:<TOKEN>` per NordVPN's API.
export async function deriveNordVpnPrivateKey(
  token: string,
  base = NORD_CREDENTIALS_URL,
): Promise<string> {
  const auth = "Basic " + btoa(`token:${token.trim()}`);
  const res = await withRetry(() =>
    fetch(base, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(15000),
    }),
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `NordVPN rejected the access token (HTTP ${res.status}). Create a fresh ` +
        `token at ${NORDVPN_TOKEN_URL} and paste it again.`,
    );
  }
  if (!res.ok) {
    throw new Error(`NordVPN credentials request failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { nordlynx_private_key?: string };
  const key = data.nordlynx_private_key?.trim();
  if (!key) {
    throw new Error(
      "NordVPN credentials response did not include a nordlynx_private_key. " +
        "Make sure the token belongs to an active NordVPN subscription.",
    );
  }
  return key;
}

// Resolve the WireGuard private key just before rendering compose. For a NordVPN
// install the persisted state holds the access *token*, not the WG key, so both
// the installer and `arrstack update` must turn it into the real key here (the
// state file deliberately keeps the token so reconfigure/--resume stay valid).
// A value that already looks like a WG key is returned unchanged.
export async function resolveVpnWireguardKey<
  T extends { enabled: boolean; provider?: string; private_key?: string },
>(vpn: T): Promise<T> {
  if (
    vpn.enabled &&
    vpn.provider === "nordvpn" &&
    vpn.private_key &&
    isNordVpnToken(vpn.private_key)
  ) {
    return { ...vpn, private_key: await deriveNordVpnPrivateKey(vpn.private_key) };
  }
  return vpn;
}
