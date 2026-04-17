/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  title: string;
  hint?: string;
}

// Kept for backward compatibility but sections now use SectionBox.
// This renders a simple bold title line for any standalone usage.
export function SectionHeader({ title, hint }: Props) {
  return (
    <Box>
      <Text bold color={colors.sectionTitle}>{title}</Text>
      {hint && <Text color={colors.muted}> {hint}</Text>}
    </Box>
  );
}
