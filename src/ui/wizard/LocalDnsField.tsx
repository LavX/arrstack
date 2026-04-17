/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
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
  focusedField,
}: LocalDnsFieldProps) {
  const checkboxFocused = focusedField === 0;
  const mark = enabled ? "x" : " ";

  return (
    <Box flexDirection="column">
      <SectionHeader title="LOCAL HOSTNAMES" hint="(optional)" />
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={checkboxFocused ? colors.accent : undefined}>
            [{mark}] Install local DNS
          </Text>
        </Box>
        {enabled && (
          <Box marginTop={1}>
            <TextInput
              label="TLD"
              value={tld}
              onChange={onTldChange}
              hint="Resolves *.arrstack.local on this LAN via dnsmasq on port 53"
              isFocused={focusedField === 1}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
