/** @jsxImportSource react */
import React from "react";
import { Box, Text, useInput } from "ink";

interface WelcomeScreenProps {
  onContinue: () => void;
  onCancel: () => void;
}

export function WelcomeScreen({ onContinue, onCancel }: WelcomeScreenProps) {
  useInput((_input, key) => {
    if (key.return) {
      onContinue();
    }
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box paddingLeft={2}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingX={3}
        paddingY={1}
        width={60}
      >
        <Text> </Text>
        <Text bold color="white">arrstack installer</Text>
        <Text> </Text>
        <Text>This will set up a complete media server on this</Text>
        <Text>machine: Sonarr, Radarr, Jellyfin, and 7 more</Text>
        <Text>services, all pre-configured and cross-wired.</Text>
        <Text> </Text>
        <Text>The next screen shows a form with sensible defaults.</Text>
        <Text>Most users just hit Enter to install.</Text>
        <Text> </Text>
        <Text bold>Navigation:</Text>
        <Text>  <Text color="cyan">Tab / Shift+Tab</Text>{"    move between fields"}</Text>
        <Text>  <Text color="cyan">Space</Text>{"              toggle checkboxes and radios"}</Text>
        <Text>  <Text color="cyan">Type</Text>{"               edit text fields"}</Text>
        <Text>  <Text color="cyan">Enter</Text>{"              install with current settings"}</Text>
        <Text>  <Text color="cyan">Esc</Text>{"                cancel and exit"}</Text>
        <Text> </Text>
        <Text color="cyan">Press Enter to continue...</Text>
        <Text> </Text>
      </Box>
    </Box>
  );
}
