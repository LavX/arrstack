/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: RadioOption[];
  selected: string;
  onChange: (val: string) => void;
  focusedIndex: number;
  inline?: boolean;
}

export function Radio({ options, selected, focusedIndex, inline = false }: Props) {
  if (inline) {
    return (
      <Box>
        {options.map((option, idx) => {
          const isSelected = option.value === selected;
          const isFocused = idx === focusedIndex;
          const mark = isSelected ? "\u25CF" : "\u25CB";
          return (
            <Box key={option.value} marginRight={2}>
              <Text color={isFocused ? colors.accent : undefined}>
                {mark} {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {options.map((option, idx) => {
        const isSelected = option.value === selected;
        const isFocused = idx === focusedIndex;
        const mark = isSelected ? "\u25CF" : "\u25CB";
        return (
          <Box key={option.value}>
            <Text color={isFocused ? colors.accent : undefined}>
              {mark} {option.label}
            </Text>
            {option.hint && (
              <Text color={colors.muted}>  {option.hint}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
