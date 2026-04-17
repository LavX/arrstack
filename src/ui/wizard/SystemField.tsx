/** @jsxImportSource react */
import React from "react";
import { Box } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
import { TextInput } from "../shared/TextInput.js";
import { Radio, RadioOption } from "../shared/Radio.js";

interface SystemFieldProps {
  timezone: string;
  puid: number;
  pgid: number;
  vpnMode: "none" | "gluetun";
  onTimezoneChange: (val: string) => void;
  onPuidChange: (val: string) => void;
  onPgidChange: (val: string) => void;
  onVpnChange: (val: string) => void;
  isFocused: boolean;
  focusedField: number; // 0 = timezone, 1 = puid/pgid, 2 = vpn radio
}

const VPN_OPTIONS: RadioOption[] = [
  { value: "none", label: "none" },
  { value: "gluetun", label: "gluetun+wireguard" },
];

export function SystemField({
  timezone,
  puid,
  pgid,
  vpnMode,
  onTimezoneChange,
  onPuidChange,
  onVpnChange,
  focusedField,
}: SystemFieldProps) {
  const puidPgid = `${puid}/${pgid}`;

  return (
    <Box flexDirection="column">
      <SectionHeader title="SYSTEM" />
      <Box flexDirection="column" marginTop={1}>
        <TextInput
          label="Timezone"
          value={timezone}
          onChange={onTimezoneChange}
          isFocused={focusedField === 0}
        />
        <TextInput
          label="PUID/PGID"
          value={puidPgid}
          onChange={onPuidChange}
          hint="e.g. 1000/1000"
          isFocused={focusedField === 1}
        />
        <Box marginTop={1}>
          <Radio
            options={VPN_OPTIONS}
            selected={vpnMode}
            onChange={onVpnChange}
            focusedIndex={focusedField === 2 ? VPN_OPTIONS.findIndex((o) => o.value === vpnMode) : -1}
          />
        </Box>
      </Box>
    </Box>
  );
}
