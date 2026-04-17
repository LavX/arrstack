/** @jsxImportSource react */
import React, { useState } from "react";
import { Box, Text } from "ink";
import type { State } from "../state/schema.js";
import { Form } from "./wizard/Form.js";
import { DoneScreen } from "./done/DoneScreen.js";

type Screen = "wizard" | "progress" | "done";

interface AppProps {
  existingState?: State | null;
}

export function App({ existingState }: AppProps) {
  const [screen, setScreen] = useState<Screen>("wizard");
  const [wizardResult, setWizardResult] = useState<State | null>(null);
  const [installResult, setInstallResult] = useState<{
    urls: Array<{ name: string; url: string; description: string }>;
    password: string;
    adminUser: string;
  } | null>(null);

  function onWizardSubmit(state: State) {
    setWizardResult(state);
    setScreen("progress");
  }

  function onWizardCancel() {
    process.exit(0);
  }

  function onInstallDone(result: {
    urls: Array<{ name: string; url: string; description: string }>;
    password: string;
    adminUser: string;
  }) {
    setInstallResult(result);
    setScreen("done");
  }

  return (
    <Box flexDirection="column" padding={1}>
      {screen === "wizard" && (
        <Form
          initial={existingState}
          isReconfigure={existingState != null}
          onSubmit={onWizardSubmit}
          onCancel={onWizardCancel}
        />
      )}
      {screen === "progress" && (
        <Text>Progress will render here (iteration 5)</Text>
      )}
      {screen === "done" && installResult && (
        <DoneScreen
          urls={installResult.urls}
          password={installResult.password}
          adminUser={installResult.adminUser}
        />
      )}
    </Box>
  );
}
