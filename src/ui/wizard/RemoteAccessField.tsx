/** @jsxImportSource react */
import React from "react";
import { SectionBox } from "../shared/SectionBox.js";
import { Radio, RadioOption } from "../shared/Radio.js";
import { TextInput } from "../shared/TextInput.js";

interface RemoteAccessFieldProps {
  mode: "none" | "duckdns" | "cloudflare";
  domain: string;
  token: string;
  onDomainChange: (val: string) => void;
  onTokenChange: (val: string) => void;
  isFocused: boolean;
  focusedField: number; // 0 = mode radio, 1 = domain input, 2 = token input
}

const MODE_OPTIONS: RadioOption[] = [
  { value: "none", label: "None (LAN)" },
  { value: "duckdns", label: "DuckDNS (free)" },
  { value: "cloudflare", label: "Cloudflare" },
];

export function RemoteAccessField({
  mode,
  domain,
  token,
  onDomainChange,
  onTokenChange,
  isFocused,
  focusedField,
}: RemoteAccessFieldProps) {
  return (
    <SectionBox title="REMOTE ACCESS" hint="(optional)" isFocused={isFocused}>
      <Radio
        options={MODE_OPTIONS}
        selected={mode}
        focusedIndex={focusedField === 0 ? MODE_OPTIONS.findIndex((o) => o.value === mode) : -1}
        inline
      />
      {mode === "duckdns" && (
        <>
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
        </>
      )}
      {mode === "cloudflare" && (
        <>
          <TextInput
            label="Domain"
            value={domain}
            onChange={onDomainChange}
            hint='e.g. arr.lavx.hu'
            isFocused={focusedField === 1}
          />
          <TextInput
            label="CF API token"
            value={token}
            onChange={onTokenChange}
            isFocused={focusedField === 2}
          />
        </>
      )}
    </SectionBox>
  );
}
