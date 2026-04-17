/** @jsxImportSource react */
import React, { useState } from "react";
import { Box, Text } from "ink";
import type { State } from "../state/schema.js";
import { HEADER } from "./shared/theme.js";

type Screen = "wizard" | "progress" | "done";

interface AppProps {
  existingState?: State | null;
}

export function App({ existingState }: AppProps) {
  const [screen, setScreen] = useState<Screen>("wizard");
  const [wizardResult, setWizardResult] = useState<Partial<State>>(existingState ?? {});
  const [installResult, setInstallResult] = useState<{
    urls: Array<{ name: string; url: string; description: string }>;
    password: string;
  } | null>(null);

  function onWizardSubmit(state: Partial<State>) {
    setWizardResult(state);
    setScreen("progress");
  }

  function onInstallDone(result: {
    urls: Array<{ name: string; url: string; description: string }>;
    password: string;
  }) {
    setInstallResult(result);
    setScreen("done");
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{HEADER}</Text>
      <Box marginTop={1}>
        {screen === "wizard" && (
          <Text>Form will render here (iteration 4)</Text>
        )}
        {screen === "progress" && (
          <Text>Progress will render here (iteration 4)</Text>
        )}
        {screen === "done" && (
          <Text>Done will render here (iteration 5)</Text>
        )}
      </Box>
    </Box>
  );
}
