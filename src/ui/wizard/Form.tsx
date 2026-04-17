/** @jsxImportSource react */
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { State } from "../../state/schema.js";
import { HEADER, colors } from "../shared/theme.js";
import { useWizardState } from "./useWizardState.js";
import { StorageField } from "./StorageField.js";
import { AdminField } from "./AdminField.js";
import { GpuField } from "./GpuField.js";
import { ServicesField } from "./ServicesField.js";
import { RemoteAccessField } from "./RemoteAccessField.js";
import { LocalDnsField } from "./LocalDnsField.js";
import { SystemField } from "./SystemField.js";
import { StatusStrip } from "./StatusStrip.js";

export interface FormProps {
  initial?: Partial<State> | null;
  isReconfigure: boolean;
  onSubmit: (state: State, adminPassword: string) => void;
  onCancel?: () => void;
}

// Section indices
const SEC_STORAGE = 0;    // 2 fields: storageRoot, extraPaths
const SEC_ADMIN = 1;      // 2 fields: username, password
const SEC_GPU = 2;        // 1 field (radio): gpu vendor
const SEC_SERVICES = 3;   // n fields (checkbox grid): services
const SEC_REMOTE = 4;     // 3 fields: mode radio, domain, token
const SEC_LOCALDNS = 5;   // 2 fields: enabled toggle, tld
const SEC_SYSTEM = 6;     // 3 fields: timezone, puid/pgid, vpn radio
const SEC_FOOTER = 7;     // 2 items: Install, Cancel

// Field counts per section
function sectionFieldCount(
  section: number,
  servicesCount: number,
  remoteMode: string
): number {
  switch (section) {
    case SEC_STORAGE:  return 2;
    case SEC_ADMIN:    return 2;
    case SEC_GPU:      return 1;
    case SEC_SERVICES: return servicesCount;
    case SEC_REMOTE:
      // mode radio + domain + token (only if duckdns/cloudflare)
      return remoteMode !== "none" ? 3 : 1;
    case SEC_LOCALDNS: return 2;
    case SEC_SYSTEM:   return 3;
    case SEC_FOOTER:   return 2; // Install, Cancel
    default:           return 1;
  }
}

const SECTION_COUNT = 8;

export function Form({ initial, isReconfigure, onSubmit, onCancel }: FormProps) {
  const ws = useWizardState(initial ?? undefined);

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);

  function maxField(section: number) {
    return sectionFieldCount(section, ws.services.length, ws.remoteMode) - 1;
  }

  function advance() {
    const max = maxField(activeSectionIndex);
    if (activeFieldIndex < max) {
      setActiveFieldIndex((f) => f + 1);
    } else {
      const nextSection = (activeSectionIndex + 1) % SECTION_COUNT;
      setActiveSectionIndex(nextSection);
      setActiveFieldIndex(0);
    }
  }

  function retreat() {
    if (activeFieldIndex > 0) {
      setActiveFieldIndex((f) => f - 1);
    } else {
      const prevSection = (activeSectionIndex - 1 + SECTION_COUNT) % SECTION_COUNT;
      setActiveSectionIndex(prevSection);
      setActiveFieldIndex(maxField(prevSection));
    }
  }

  useInput((input, key) => {
    // Tab / Shift-Tab for navigation
    if (key.tab) {
      if (key.shift) {
        retreat();
      } else {
        advance();
      }
      return;
    }

    // Enter on Install button or Ctrl+Enter anywhere
    if (key.return) {
      if (activeSectionIndex === SEC_FOOTER && activeFieldIndex === 0) {
        onSubmit(ws.toState(), ws.adminPassword);
        return;
      }
      if (activeSectionIndex === SEC_FOOTER && activeFieldIndex === 1) {
        onCancel?.();
        return;
      }
      return;
    }

    // Escape = cancel
    if (key.escape) {
      onCancel?.();
      return;
    }

    // Space = toggle for Services and LocalDns checkbox
    if (input === " ") {
      if (activeSectionIndex === SEC_SERVICES) {
        const svc = ws.services[activeFieldIndex];
        if (svc) ws.toggleService(svc.id);
      }
      if (activeSectionIndex === SEC_LOCALDNS && activeFieldIndex === 0) {
        ws.setLocalDnsEnabled(!ws.localDnsEnabled);
      }
      return;
    }

    // "a" = select all services, "n" = select none
    if (activeSectionIndex === SEC_SERVICES) {
      if (input === "a") {
        ws.setServices((prev) => prev.map((s) => ({ ...s, checked: true })));
        return;
      }
      if (input === "n") {
        ws.setServices((prev) => prev.map((s) => ({ ...s, checked: false })));
        return;
      }
    }

    // Arrow keys for radio/checkbox navigation within a section
    if (key.upArrow || key.downArrow) {
      const isDown = key.downArrow;
      if (activeSectionIndex === SEC_GPU) {
        // handled by field index, advance/retreat within section
        isDown ? advance() : retreat();
        return;
      }
      if (activeSectionIndex === SEC_REMOTE && activeFieldIndex === 0) {
        // cycle through remote mode options
        const modes = ["none", "duckdns", "cloudflare"] as const;
        const idx = modes.indexOf(ws.remoteMode as (typeof modes)[number]);
        const next = isDown
          ? (idx + 1) % modes.length
          : (idx - 1 + modes.length) % modes.length;
        ws.setRemoteMode(modes[next]);
        return;
      }
      if (activeSectionIndex === SEC_SYSTEM && activeFieldIndex === 2) {
        // cycle through vpn modes
        const vpns = ["none", "gluetun"] as const;
        const idx = vpns.indexOf(ws.vpnMode as (typeof vpns)[number]);
        const next = isDown
          ? (idx + 1) % vpns.length
          : (idx - 1 + vpns.length) % vpns.length;
        ws.setVpnMode(vpns[next]);
        return;
      }
    }

    // "r" in admin password field = regenerate password
    if (
      activeSectionIndex === SEC_ADMIN &&
      activeFieldIndex === 1 &&
      input === "r"
    ) {
      const { generatePassword } = require("../../lib/random.js");
      ws.setAdminPassword(generatePassword());
      return;
    }
  });

  // Derive focused props per section
  const storageFocusedField = activeSectionIndex === SEC_STORAGE ? activeFieldIndex : -1;
  const adminFocusedField = activeSectionIndex === SEC_ADMIN ? activeFieldIndex : -1;
  const gpuIsFocused = activeSectionIndex === SEC_GPU;
  const gpuFocusedIndex = gpuIsFocused ? activeFieldIndex : -1;
  const servicesIsFocused = activeSectionIndex === SEC_SERVICES;
  const servicesFocusedIndex = servicesIsFocused ? activeFieldIndex : -1;
  const remoteFocusedField = activeSectionIndex === SEC_REMOTE ? activeFieldIndex : -1;
  const localDnsFocusedField = activeSectionIndex === SEC_LOCALDNS ? activeFieldIndex : -1;
  const systemFocusedField = activeSectionIndex === SEC_SYSTEM ? activeFieldIndex : -1;

  const installLabel = isReconfigure ? "Apply changes" : "Install";
  const installFocused = activeSectionIndex === SEC_FOOTER && activeFieldIndex === 0;
  const cancelFocused = activeSectionIndex === SEC_FOOTER && activeFieldIndex === 1;

  return (
    <Box flexDirection="column">
      {/* Header bar */}
      <Box justifyContent="space-between">
        <Text bold color="cyan">{HEADER}</Text>
        {ws.hostname && (
          <Text color={colors.muted}>{ws.hostname}</Text>
        )}
      </Box>
      <Text color={colors.muted}>{"─".repeat(58)}</Text>

      {/* Sections */}
      <StorageField
        storageRoot={ws.storageRoot}
        extraPaths={ws.extraPaths}
        onStorageRootChange={ws.setStorageRoot}
        onExtraPathsChange={ws.setExtraPaths}
        focusedField={storageFocusedField}
      />

      <AdminField
        username={ws.adminUsername}
        password={ws.adminPassword}
        onUsernameChange={ws.setAdminUsername}
        onPasswordChange={ws.setAdminPassword}
        focusedField={adminFocusedField}
      />

      <GpuField
        detectedGpus={ws.detectedGpus}
        selected={ws.gpuVendor}
        onChange={ws.setGpuVendor}
        isFocused={gpuIsFocused}
        focusedIndex={gpuFocusedIndex}
      />

      <ServicesField
        services={ws.services}
        onChange={ws.toggleService}
        isFocused={servicesIsFocused}
        focusedIndex={servicesFocusedIndex}
      />

      <RemoteAccessField
        mode={ws.remoteMode}
        domain={ws.remoteDomain}
        token={ws.remoteToken}
        onModeChange={(v) => ws.setRemoteMode(v as "none" | "duckdns" | "cloudflare")}
        onDomainChange={ws.setRemoteDomain}
        onTokenChange={ws.setRemoteToken}
        isFocused={activeSectionIndex === SEC_REMOTE}
        focusedField={remoteFocusedField}
      />

      <LocalDnsField
        enabled={ws.localDnsEnabled}
        tld={ws.localDnsTld}
        onEnabledChange={ws.setLocalDnsEnabled}
        onTldChange={ws.setLocalDnsTld}
        isFocused={activeSectionIndex === SEC_LOCALDNS}
        focusedField={localDnsFocusedField}
      />

      <SystemField
        timezone={ws.timezone}
        puid={ws.puid}
        pgid={ws.pgid}
        vpnMode={ws.vpnMode}
        onTimezoneChange={ws.setTimezone}
        onPuidChange={(v) => {
          const [p, g] = v.split("/").map(Number);
          if (!isNaN(p)) ws.setPuid(p);
          if (!isNaN(g)) ws.setPgid(g);
        }}
        onPgidChange={(v) => {
          const n = Number(v);
          if (!isNaN(n)) ws.setPgid(n);
        }}
        onVpnChange={(v) => ws.setVpnMode(v as "none" | "gluetun")}
        isFocused={activeSectionIndex === SEC_SYSTEM}
        focusedField={systemFocusedField}
      />

      {/* Status strip */}
      <Box marginTop={0}>
        <StatusStrip
          diskInfo={[]}
          dockerOk={false}
          portsOk={false}
          gpuName={ws.detectedGpus.find((g) => g.vendor === ws.gpuVendor)?.name}
        />
      </Box>

      {/* Separator */}
      <Text color={colors.muted}>{"─".repeat(58)}</Text>

      {/* Footer with actions and keybindings */}
      <Box justifyContent="space-between">
        <Box gap={2}>
          <Text
            bold
            color={installFocused ? "black" : "white"}
            backgroundColor={installFocused ? "green" : undefined}
          >
            {` ${installLabel} `}
          </Text>
          <Text
            color={cancelFocused ? "black" : colors.muted}
            backgroundColor={cancelFocused ? "yellow" : undefined}
          >
            {" Cancel "}
          </Text>
        </Box>
        <Box gap={1}>
          <Text color={colors.muted}>Tab</Text>
          <Text color={colors.muted} dimColor>next</Text>
          <Text color={colors.muted}> Space</Text>
          <Text color={colors.muted} dimColor>toggle</Text>
          <Text color={colors.muted}> Enter</Text>
          <Text color={colors.muted} dimColor>install</Text>
          <Text color={colors.muted}> Esc</Text>
          <Text color={colors.muted} dimColor>cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
