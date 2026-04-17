/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { colors } from "../shared/theme.js";

interface LocalDnsFieldProps {
  enabled: boolean;
  tld: string;
  onEnabledChange: (val: boolean) => void;
  onTldChange: (val: string) => void;
  isFocused: boolean;
  focusedField: number; // 0 = checkbox, 1 = tld input
}

export function LocalDnsField({
  enabled,
  tld,
  onEnabledChange,
  onTldChange,
  isFocused,
  focusedField,
}: LocalDnsFieldProps) {
  const checkboxFocused = focusedField === 0;
  const mark = enabled ? "x" : " ";

  return (
    <SectionBox title="LOCAL HOSTNAMES" hint="(optional)" isFocused={isFocused}>
      <Box>
        <Text color={checkboxFocused ? colors.accent : undefined}>
          [{mark}] Install local DNS
        </Text>
        {enabled && (
          <Text color={colors.muted}>  (resolve *.arrstack.{tld})</Text>
        )}
      </Box>
      {enabled && (
        <TextInput
          label="TLD"
          value={tld}
          onChange={onTldChange}
          isFocused={focusedField === 1}
        />
      )}
    </SectionBox>
  );
}
