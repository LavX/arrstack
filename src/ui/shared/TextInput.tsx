/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import InkTextInput from "ink-text-input";
import { colors } from "./theme.js";

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  hint?: string;
  isFocused: boolean;
  width?: number;
}

export function TextInput({ label, value, onChange, hint, isFocused, width = 20 }: Props) {
  const padded = label.padStart(width, ".");

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isFocused ? colors.accent : undefined}>{padded}: </Text>
        {isFocused ? (
          <InkTextInput value={value} onChange={onChange} />
        ) : (
          <Text>{value}</Text>
        )}
      </Box>
      {hint && (
        <Box marginLeft={width + 2}>
          <Text color={colors.muted}>{hint}</Text>
        </Box>
      )}
    </Box>
  );
}
