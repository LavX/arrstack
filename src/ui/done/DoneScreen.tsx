/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../shared/theme.js";

interface DoneScreenProps {
  urls: Array<{ name: string; url: string; description: string }>;
  password: string;
  adminUser: string;
}

export function DoneScreen({ urls, password, adminUser }: DoneScreenProps) {
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
      {urls.map(({ name, url, description }) => (
        <Box key={name}>
          <Text>{name.padEnd(14)}</Text>
          <Text>{url}</Text>
          <Text color={colors.muted}>{"  "}{description}</Text>
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

      <Text> </Text>

      <Text color={colors.muted}>Day-two: arrstack doctor | arrstack update | arrstack show-password</Text>
    </Box>
  );
}
