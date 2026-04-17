/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  title: string;
  hint?: string;
  isFocused?: boolean;
  children: React.ReactNode;
}

export function SectionBox({ title, hint, isFocused, children }: Props) {
  const borderColor = isFocused ? colors.highlight : colors.border;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
    >
      <Box>
        <Text bold color={colors.sectionTitle}>{title}</Text>
        {hint && <Text color={colors.muted}> {hint}</Text>}
      </Box>
      {children}
    </Box>
  );
}
