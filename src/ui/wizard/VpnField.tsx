/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { Radio, RadioOption } from "../shared/Radio.js";
import { colors, LABEL_WIDTH } from "../shared/theme.js";

export type VpnMode = "none" | "gluetun";
export type VpnProvider = "mullvad" | "protonvpn" | "custom";

interface VpnFieldProps {
  mode: VpnMode;
  provider: VpnProvider;
  privateKey: string;
  addresses: string;
  countries: string;
  endpointIp: string;
  endpointPort: string;
  serverPublicKey: string;
  onPrivateKeyChange: (v: string) => void;
  onAddressesChange: (v: string) => void;
  onCountriesChange: (v: string) => void;
  onEndpointIpChange: (v: string) => void;
  onEndpointPortChange: (v: string) => void;
  onServerPublicKeyChange: (v: string) => void;
  isFocused: boolean;
  // Field layout:
  //   mode === "none":                     [0] = mode radio
  //   mode === "gluetun":                  [0]=mode, [1]=provider, [2]=private key,
  //                                        [3]=addresses, [4]=countries
  //   mode === "gluetun" && custom:        [5]=endpoint ip, [6]=endpoint port,
  //                                        [7]=server public key
  focusedField: number;
}

const MODE_OPTIONS: RadioOption[] = [
  { value: "none", label: "none" },
  { value: "gluetun", label: "gluetun+wireguard" },
];

const PROVIDER_OPTIONS: RadioOption[] = [
  { value: "mullvad", label: "mullvad" },
  { value: "protonvpn", label: "protonvpn" },
  { value: "custom", label: "custom" },
];

export function VpnField({
  mode,
  provider,
  privateKey,
  addresses,
  countries,
  endpointIp,
  endpointPort,
  serverPublicKey,
  onPrivateKeyChange,
  onAddressesChange,
  onCountriesChange,
  onEndpointIpChange,
  onEndpointPortChange,
  onServerPublicKeyChange,
  isFocused,
  focusedField,
}: VpnFieldProps) {
  const enabled = mode === "gluetun";
  const isCustom = provider === "custom";

  return (
    <SectionBox title="VPN" isFocused={isFocused}>
      <Box>
        <Text color={focusedField === 0 ? colors.accent : "white"}>
          {"VPN".padEnd(LABEL_WIDTH)}
        </Text>
        <Radio
          options={MODE_OPTIONS}
          selected={mode}
          focusedIndex={focusedField === 0 ? MODE_OPTIONS.findIndex((o) => o.value === mode) : -1}
          inline
        />
      </Box>

      {enabled && (
        <>
          <Box>
            <Text color={focusedField === 1 ? colors.accent : "white"}>
              {"Provider".padEnd(LABEL_WIDTH)}
            </Text>
            <Radio
              options={PROVIDER_OPTIONS}
              selected={provider}
              focusedIndex={
                focusedField === 1 ? PROVIDER_OPTIONS.findIndex((o) => o.value === provider) : -1
              }
              inline
            />
          </Box>

          <TextInput
            label="WG private key"
            value={privateKey}
            onChange={onPrivateKeyChange}
            hint="from your provider's WireGuard config"
            isFocused={focusedField === 2}
          />
          <TextInput
            label="WG addresses"
            value={addresses}
            onChange={onAddressesChange}
            hint="e.g. 10.64.222.21/32"
            isFocused={focusedField === 3}
          />
          <TextInput
            label="Countries"
            value={countries}
            onChange={onCountriesChange}
            hint="optional, e.g. Switzerland,Sweden"
            isFocused={focusedField === 4}
          />

          {isCustom && (
            <>
              <TextInput
                label="Endpoint IP"
                value={endpointIp}
                onChange={onEndpointIpChange}
                hint="server public IP"
                isFocused={focusedField === 5}
              />
              <TextInput
                label="Endpoint port"
                value={endpointPort}
                onChange={onEndpointPortChange}
                hint="e.g. 51820"
                isFocused={focusedField === 6}
              />
              <TextInput
                label="Server pubkey"
                value={serverPublicKey}
                onChange={onServerPublicKeyChange}
                hint="WG peer public key"
                isFocused={focusedField === 7}
              />
            </>
          )}
        </>
      )}
    </SectionBox>
  );
}
