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
  return (
    <Box flexDirection="column">
      <Text bold color={colors.primary}>arrstack is running.</Text>

      <Text> </Text>

      <Text>Admin credentials (also saved to /opt/arrstack/admin.txt):</Text>
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

      <Text> </Text>

      <Text color={colors.muted}>Day-two: arrstack doctor | arrstack update | arrstack show-password</Text>
    </Box>
  );
}
