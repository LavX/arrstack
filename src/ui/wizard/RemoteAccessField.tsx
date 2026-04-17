/** @jsxImportSource react */
import React from "react";
import { Box } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
import { Radio, RadioOption } from "../shared/Radio.js";
import { TextInput } from "../shared/TextInput.js";

interface RemoteAccessFieldProps {
  mode: "none" | "duckdns" | "cloudflare";
  domain: string;
  token: string;
  onModeChange: (val: string) => void;
  onDomainChange: (val: string) => void;
  onTokenChange: (val: string) => void;
  isFocused: boolean;
  focusedField: number; // 0 = mode radio, 1 = domain input, 2 = token input
}

const MODE_OPTIONS: RadioOption[] = [
  { value: "none", label: "None (LAN only, access via host IP:port)" },
  { value: "duckdns", label: "DuckDNS (free, no domain needed)" },
  { value: "cloudflare", label: "Cloudflare (you own a domain)" },
];

export function RemoteAccessField({
  mode,
  domain,
  token,
  onModeChange,
  onDomainChange,
  onTokenChange,
  focusedField,
}: RemoteAccessFieldProps) {
  return (
    <Box flexDirection="column">
      <SectionHeader title="REMOTE ACCESS" hint="(optional)" />
      <Box flexDirection="column" marginTop={1}>
        <Radio
          options={MODE_OPTIONS}
          selected={mode}
          onChange={onModeChange}
          focusedIndex={focusedField === 0 ? MODE_OPTIONS.findIndex((o) => o.value === mode) : -1}
        />
        {mode === "duckdns" && (
          <Box flexDirection="column" marginTop={1}>
            <TextInput
              label="Subdomain"
              value={domain}
              onChange={onDomainChange}
              hint=".duckdns.org"
              isFocused={focusedField === 1}
            />
            <TextInput
              label="DuckDNS token"
              value={token}
              onChange={onTokenChange}
              isFocused={focusedField === 2}
            />
          </Box>
        )}
        {mode === "cloudflare" && (
          <Box flexDirection="column" marginTop={1}>
            <TextInput
              label="Domain"
              value={domain}
              onChange={onDomainChange}
              hint='e.g. "arr.lavx.hu"'
              isFocused={focusedField === 1}
            />
            <TextInput
              label="CF API token"
              value={token}
              onChange={onTokenChange}
              hint="DNS Edit scope on your zone"
              isFocused={focusedField === 2}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
