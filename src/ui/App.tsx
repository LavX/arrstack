/** @jsxImportSource react */
import React, { useState, useEffect, useRef } from "react";
import { Box } from "ink";
import type { State } from "../state/schema.js";
import { WelcomeScreen } from "./wizard/WelcomeScreen.js";
import { Form } from "./wizard/Form.js";
import { DoneScreen } from "./done/DoneScreen.js";
import { ProgressView } from "./progress/ProgressView.js";
import type { StepUpdate } from "./progress/ProgressView.js";
import { runInstall } from "../usecase/install.js";
import type { InstallResult } from "../usecase/install.js";

type Screen = "welcome" | "wizard" | "progress" | "done";

interface AppProps {
  existingState?: State | null;
}

interface ProgressRunnerProps {
  state: State;
  adminPassword: string;
  onDone: (result: InstallResult) => void;
}

function ProgressRunner({ state, adminPassword, onDone }: ProgressRunnerProps) {
  const [steps, setSteps] = useState<StepUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    runInstall(state, adminPassword, (update) => {
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === update.step);
        if (idx === -1) return [...prev, update];
        const next = [...prev];
        next[idx] = update;
        return next;
      });
    })
      .then((result) => {
        onDone(result);
      })
      .catch((err: any) => {
        setError(err.message ?? String(err));
      });
  }, []);

  return <ProgressView steps={steps} error={error} />;
}

export function App({ existingState }: AppProps) {
  const [screen, setScreen] = useState<Screen>(existingState ? "wizard" : "welcome");
  const [wizardState, setWizardState] = useState<State | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);

  function onWizardSubmit(state: State, password: string) {
    setWizardState(state);
    setAdminPassword(password);
    setScreen("progress");
  }

  function onWizardCancel() {
    process.exit(0);
  }

  function onInstallDone(result: InstallResult) {
    setInstallResult(result);
    setScreen("done");
  }

  return (
    <Box flexDirection="column" padding={1}>
      {screen === "welcome" && (
        <WelcomeScreen
          onContinue={() => setScreen("wizard")}
          onCancel={() => process.exit(0)}
        />
      )}
      {screen === "wizard" && (
        <Form
          initial={existingState}
          isReconfigure={existingState != null}
          onSubmit={onWizardSubmit}
          onCancel={onWizardCancel}
        />
      )}
      {screen === "progress" && wizardState && (
        <ProgressRunner
          state={wizardState}
          adminPassword={adminPassword}
          onDone={onInstallDone}
        />
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
