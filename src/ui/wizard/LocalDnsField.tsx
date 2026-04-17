/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { colors } from "../shared/theme.js";

interface LocalDnsFieldProps {
  enabled: boolean;
  installDnsmasq: boolean;
  tld: string;
  onEnabledChange: (val: boolean) => void;
  onInstallDnsmasqChange: (val: boolean) => void;
  onTldChange: (val: string) => void;
  isFocused: boolean;
  // 0 = Hostnames toggle, 1 = dnsmasq sub-toggle (when enabled), 2 = tld input
  focusedField: number;
}

export function LocalDnsField({
  enabled,
  installDnsmasq,
  tld,
  isFocused,
  focusedField,
  onTldChange,
}: LocalDnsFieldProps) {
  const mark = (on: boolean) => (on ? "x" : " ");

  return (
    <SectionBox title="LOCAL HOSTNAMES" hint="(optional)" isFocused={isFocused}>
      <Box>
        <Text color={focusedField === 0 ? colors.accent : undefined}>
          [{mark(enabled)}] Install local DNS
        </Text>
        {enabled && (
          <Text color={colors.muted}>
            {"  "}(Caddy serves http://svc.{tld})
          </Text>
        )}
      </Box>
      {enabled && (
        <>
          <Box>
            <Text color={focusedField === 1 ? colors.accent : undefined}>
              [{mark(installDnsmasq)}] Install DNS server (dnsmasq) for LAN-wide
              resolution
            </Text>
          </Box>
          <Text color={colors.muted}>
            {"  "}
            {installDnsmasq
              ? "clients that use this host's :53 will resolve names automatically"
              : "no DNS — paste the /etc/hosts line from FIRST-RUN.md on each client"}
          </Text>
          <TextInput
            label="TLD"
            value={tld}
            onChange={onTldChange}
            isFocused={focusedField === 2}
          />
        </>
      )}
    </SectionBox>
  );
}
