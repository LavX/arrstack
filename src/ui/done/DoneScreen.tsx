/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../shared/theme.js";

interface DoneScreenProps {
  urls: Array<{
    name: string;
    url: string;
    // LAN fallback (http://{hostIp}:{port}); omitted when `url` is already that.
    localUrl?: string;
    description: string;
  }>;
  password: string;
  adminUser: string;
  publicAccess?: {
    mode: "duckdns" | "cloudflare";
    domain: string;
    hostIp: string;
  };
}

export function DoneScreen({
  urls,
  password,
  adminUser,
  publicAccess,
}: DoneScreenProps) {
  const bazarr = urls.find((u) => u.name === "Bazarr+" || u.name === "Bazarr");
  return (
    <Box flexDirection="column">
      <Text bold color={colors.primary}>arrstack is running.</Text>

      <Text> </Text>

      <Text>Admin credentials (also saved to ~/arrstack/admin.txt):</Text>
      <Text color={colors.accent}>{"  "}user: {adminUser}</Text>
      <Text color={colors.accent}>{"  "}pass: {password}</Text>

      <Text> </Text>

      <Text>Open in browser:</Text>
      {urls.map(({ name, url, localUrl, description }) => (
        <Box key={name} flexDirection="column">
          <Box>
            <Text>{name.padEnd(14)}</Text>
            <Text>{url}</Text>
            <Text color={colors.muted}>{"  "}{description}</Text>
          </Box>
          {localUrl && (
            <Text color={colors.muted}>
              {"              "}LAN fallback: {localUrl}
            </Text>
          )}
        </Box>
      ))}

      <Text> </Text>

      <Text>Remaining steps:</Text>
      <Text>{"  "}1. Sign in to Jellyseerr (one click)</Text>
      <Text>{"  "}2. Request a movie or show</Text>
      {bazarr && (
        <>
          <Text>
            {"  "}3. Optional: add credentials for two subtitle providers at
          </Text>
          <Text color={colors.accent}>
            {"     "}{bazarr.url}/settings/providers
          </Text>
          <Text color={colors.muted}>
            {"       "}OpenSubtitles.com (account required, free tier works)
          </Text>
          <Text color={colors.muted}>
            {"       "}Addic7ed (account required, English TV catalog)
          </Text>
          <Text color={colors.muted}>
            {"       "}All other providers work without login.
          </Text>
        </>
      )}

      {publicAccess && (
        <>
          <Text> </Text>
          <Text bold color={colors.accent}>
            Finish public access setup ({publicAccess.mode}):
          </Text>
          <Text>
            {"  "}arrstack wired HTTPS through Caddy for *.{publicAccess.domain},
          </Text>
          <Text>
            {"  "}but the public internet still has to reach your box on
            {" "}80/443.
          </Text>
          <Text> </Text>
          <Text color={colors.accent}>{"  "}1. Router / NAT</Text>
          <Text>
            {"     "}Open your router admin page and forward these two ports
          </Text>
          <Text>
            {"     "}to this host ({publicAccess.hostIp}):
          </Text>
          <Text color={colors.muted}>
            {"       "}TCP 80  -&gt; {publicAccess.hostIp}:80   (Let's Encrypt HTTP-01)
          </Text>
          <Text color={colors.muted}>
            {"       "}TCP 443 -&gt; {publicAccess.hostIp}:443  (HTTPS / every service)
          </Text>
          <Text color={colors.muted}>
            {"     "}Do NOT forward 8989/7878/8080/etc. Caddy is your single
          </Text>
          <Text color={colors.muted}>
            {"     "}public entry point; admin ports stay LAN-only.
          </Text>
          <Text> </Text>
          <Text color={colors.accent}>{"  "}2. Host firewall</Text>
          <Text>{"     "}Allow 80/443 inbound on this machine:</Text>
          <Text color={colors.muted}>
            {"       "}ufw:       sudo ufw allow 80,443/tcp
          </Text>
          <Text color={colors.muted}>
            {"       "}firewalld: sudo firewall-cmd --add-service={"{"}http,https{"}"} --permanent {"&&"} sudo firewall-cmd --reload
          </Text>
          <Text color={colors.muted}>
            {"       "}nftables:  add tcp dport {"{"} 80, 443 {"}"} accept
          </Text>
          <Text> </Text>
          <Text color={colors.accent}>{"  "}3. DNS</Text>
          {publicAccess.mode === "duckdns" ? (
            <>
              <Text>
                {"     "}DuckDNS already points {publicAccess.domain} AND
              </Text>
              <Text>
                {"     "}*.{publicAccess.domain} at your public IP — no extra DNS
              </Text>
              <Text>{"     "}records needed.</Text>
            </>
          ) : (
            <>
              <Text>{"     "}In Cloudflare DNS, create a wildcard record:</Text>
              <Text color={colors.muted}>
                {"       "}Type: A   Name: *   Content: &lt;your public IP&gt;
              </Text>
              <Text color={colors.muted}>
                {"       "}Proxy status: DNS only (gray cloud)
              </Text>
              <Text>
                {"     "}Proxied (orange cloud) breaks Let's Encrypt DNS-01
              </Text>
              <Text>{"     "}challenges for the wildcard cert.</Text>
            </>
          )}
          <Text> </Text>
          <Text color={colors.accent}>{"  "}4. Verify</Text>
          <Text>{"     "}From a cellular / off-LAN network, open</Text>
          <Text color={colors.muted}>
            {"       "}https://jellyseerr.{publicAccess.domain}
          </Text>
          <Text>
            {"     "}If the cert is trusted and the page loads, you're done.
          </Text>
          <Text color={colors.muted}>
            {"     "}LAN tip: if your router doesn't hairpin-NAT, either use
          </Text>
          <Text color={colors.muted}>
            {"     "}the LAN fallback URLs listed above, or run
          </Text>
          <Text color={colors.accent}>
            {"       "}arrstack hosts
          </Text>
          <Text color={colors.muted}>
            {"     "}to map every *.{publicAccess.domain} name to
          </Text>
          <Text color={colors.muted}>
            {"     "}{publicAccess.hostIp} in /etc/hosts (sudo required).
          </Text>
        </>
      )}

      <Text> </Text>

      <Text color={colors.muted}>Day-two: arrstack doctor | arrstack update | arrstack hosts | arrstack show-password</Text>
    </Box>
  );
}
