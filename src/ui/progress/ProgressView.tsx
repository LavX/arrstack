/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../shared/theme.js";

export type StepStatus = "pending" | "running" | "done" | "failed";
export interface StepUpdate {
  step: string;
  status: StepStatus;
  message?: string;
  durationMs?: number;
}

interface ProgressViewProps {
  steps: StepUpdate[];
  error?: string | null;
  elapsed?: number;
}

function StepRow({ update }: { update: StepUpdate }) {
  const { step, status, message, durationMs } = update;

  if (status === "done") {
    return (
      <Box>
        <Text color="green">[ok] </Text>
        <Text>{step}</Text>
        {durationMs !== undefined && (
          <Text color={colors.muted}> ({(durationMs / 1000).toFixed(1)}s)</Text>
        )}
      </Box>
    );
  }

  if (status === "running") {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> {step}</Text>
      </Box>
    );
  }

  if (status === "failed") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="red">[!!] </Text>
          <Text>{step}</Text>
        </Box>
        {message && (
          <Box marginLeft={5}>
            <Text color="red">{message}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // pending
  return (
    <Box>
      <Text color={colors.muted}>[  ] </Text>
      <Text color={colors.muted}>{step}</Text>
    </Box>
  );
}

export function ProgressView({ steps, error }: ProgressViewProps) {
  return (
    <Box flexDirection="column">
      <Text bold>Installing arrstack</Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((update) => (
          <StepRow key={update.step} update={update} />
        ))}
      </Box>
      {error && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">Install failed: {error}</Text>
          <Text color={colors.muted}>Fix the cause above and re-run: arrstack install</Text>
        </Box>
      )}
    </Box>
  );
}
