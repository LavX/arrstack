/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { Radio, RadioOption } from "../shared/Radio.js";
import { colors, LABEL_WIDTH } from "../shared/theme.js";

interface SystemFieldProps {
  timezone: string;
  puid: number;
  pgid: number;
  vpnMode: "none" | "gluetun";
  onTimezoneChange: (val: string) => void;
  onPuidChange: (val: string) => void;
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
  isFocused,
  focusedField,
}: SystemFieldProps) {
  const puidPgid = `${puid}/${pgid}`;

  return (
    <SectionBox title="SYSTEM" isFocused={isFocused}>
      <Box>
        <TextInput
          label="Timezone"
          value={timezone}
          onChange={onTimezoneChange}
          isFocused={focusedField === 0}
        />
      </Box>
      <Box>
        <TextInput
          label="UID/GID"
          value={puidPgid}
          onChange={onPuidChange}
          isFocused={focusedField === 1}
        />
      </Box>
      <Box>
        <Text color={focusedField === 2 ? colors.accent : "white"}>
          {"VPN".padEnd(LABEL_WIDTH)}
        </Text>
        <Radio
          options={VPN_OPTIONS}
          selected={vpnMode}
          focusedIndex={focusedField === 2 ? VPN_OPTIONS.findIndex((o) => o.value === vpnMode) : -1}
          inline
        />
      </Box>
    </SectionBox>
  );
}
