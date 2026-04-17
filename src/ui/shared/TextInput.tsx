/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import InkTextInput from "ink-text-input";
import { colors, LABEL_WIDTH } from "./theme.js";

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  hint?: string;
  isFocused: boolean;
  width?: number;
}

export function TextInput({ label, value, onChange, hint, isFocused, width = LABEL_WIDTH }: Props) {
  const padded = label.padEnd(width);

  return (
    <Box>
      <Text color={isFocused ? colors.accent : "white"}>{padded}</Text>
      {isFocused ? (
        <InkTextInput value={value} onChange={onChange} />
      ) : (
        <Text color={colors.value}>{value || <Text color={colors.muted}>(none)</Text>}</Text>
      )}
      {hint && !isFocused && (
        <Text color={colors.muted}>  {hint}</Text>
      )}
    </Box>
  );
}
