/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  title: string;
  hint?: string;
}

export function SectionHeader({ title, hint }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold color="blue">{title}</Text>
      {hint && <Text color={colors.muted}>{hint}</Text>}
    </Box>
  );
}
