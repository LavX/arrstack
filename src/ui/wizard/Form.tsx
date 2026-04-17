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
import { generatePassword } from "../../lib/random.js";

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
    // Up/Down arrows are the primary navigation (Tab/Shift-Tab also work as aliases)
    if (key.downArrow || (key.tab && !key.shift)) {
      // In radio sections Left/Right handles cycling, so Up/Down always navigates
      if (key.downArrow) {
        // Services section: Up/Down moves between rows; exit to next section at bottom
        if (activeSectionIndex === SEC_SERVICES) {
          const cols = 3;
          const newIdx = activeFieldIndex + cols;
          if (newIdx >= ws.services.length) {
            // At bottom of grid, move to next section
            setActiveSectionIndex(SEC_REMOTE);
            setActiveFieldIndex(0);
          } else {
            setActiveFieldIndex(newIdx);
          }
          return;
        }
        advance();
        return;
      }
      // Tab (not shift): advance
      advance();
      return;
    }

    if (key.upArrow || (key.tab && key.shift)) {
      if (key.upArrow) {
        // Services section: Up/Down moves between rows; exit to prev section at top
        if (activeSectionIndex === SEC_SERVICES) {
          const cols = 3;
          const newIdx = activeFieldIndex - cols;
          if (newIdx < 0) {
            // At top of grid, move to previous section
            setActiveSectionIndex(SEC_GPU);
            setActiveFieldIndex(0);
          } else {
            setActiveFieldIndex(newIdx);
          }
          return;
        }
        retreat();
        return;
      }
      // Shift-Tab: retreat
      retreat();
      return;
    }

    // Left/Right: cycle radio options OR move between service columns
    if (key.leftArrow || key.rightArrow) {
      const isForward = key.rightArrow;
      if (activeSectionIndex === SEC_GPU) {
        const gpuOptions = ["none", ...ws.detectedGpus.map(g => g.vendor)].filter(
          (v, i, a) => a.indexOf(v) === i
        );
        const idx = gpuOptions.indexOf(ws.gpuVendor);
        const next = isForward
          ? (idx + 1) % gpuOptions.length
          : (idx - 1 + gpuOptions.length) % gpuOptions.length;
        ws.setGpuVendor(gpuOptions[next] as "none" | "intel" | "amd" | "nvidia");
        return;
      }
      if (activeSectionIndex === SEC_REMOTE && activeFieldIndex === 0) {
        const modes = ["none", "duckdns", "cloudflare"] as const;
        const idx = modes.indexOf(ws.remoteMode as (typeof modes)[number]);
        const next = isForward
          ? (idx + 1) % modes.length
          : (idx - 1 + modes.length) % modes.length;
        ws.setRemoteMode(modes[next]);
        return;
      }
      if (activeSectionIndex === SEC_SYSTEM && activeFieldIndex === 2) {
        const vpns = ["none", "gluetun"] as const;
        const idx = vpns.indexOf(ws.vpnMode as (typeof vpns)[number]);
        const next = isForward
          ? (idx + 1) % vpns.length
          : (idx - 1 + vpns.length) % vpns.length;
        ws.setVpnMode(vpns[next]);
        return;
      }
      // Left/Right in services section: move between columns
      if (activeSectionIndex === SEC_SERVICES) {
        const newIdx = isForward
          ? Math.min(activeFieldIndex + 1, ws.services.length - 1)
          : Math.max(activeFieldIndex - 1, 0);
        setActiveFieldIndex(newIdx);
        return;
      }
      // Left/Right in footer: switch between Install and Cancel
      if (activeSectionIndex === SEC_FOOTER) {
        setActiveFieldIndex(isForward ? 1 : 0);
        return;
      }
    }

    // Enter on buttons
    if (key.return) {
      if (activeSectionIndex === SEC_FOOTER && activeFieldIndex === 0) {
        onSubmit(ws.toState(), ws.adminPassword);
        return;
      }
      if (activeSectionIndex === SEC_FOOTER && activeFieldIndex === 1) {
        onCancel?.();
        return;
      }
      advance();
      return;
    }

    // Escape = cancel
    if (key.escape) {
      onCancel?.();
      return;
    }

    // Space = toggle/cycle for services, local DNS, and all radio fields
    if (input === " ") {
      // Services toggle
      if (activeSectionIndex === SEC_SERVICES) {
        const svc = ws.services[activeFieldIndex];
        if (svc) ws.toggleService(svc.id);
        return;
      }
      // Local DNS toggle
      if (activeSectionIndex === SEC_LOCALDNS && activeFieldIndex === 0) {
        ws.setLocalDnsEnabled(!ws.localDnsEnabled);
        return;
      }
      // GPU radio: cycle to next
      if (activeSectionIndex === SEC_GPU) {
        const gpuOptions = ["none", ...ws.detectedGpus.map(g => g.vendor)].filter(
          (v, i, a) => a.indexOf(v) === i
        );
        const idx = gpuOptions.indexOf(ws.gpuVendor);
        ws.setGpuVendor(gpuOptions[(idx + 1) % gpuOptions.length] as "none" | "intel" | "amd" | "nvidia");
        return;
      }
      // Remote mode radio: cycle to next
      if (activeSectionIndex === SEC_REMOTE && activeFieldIndex === 0) {
        const modes = ["none", "duckdns", "cloudflare"] as const;
        const idx = modes.indexOf(ws.remoteMode as (typeof modes)[number]);
        ws.setRemoteMode(modes[(idx + 1) % modes.length]);
        return;
      }
      // VPN radio: cycle to next
      if (activeSectionIndex === SEC_SYSTEM && activeFieldIndex === 2) {
        const vpns = ["none", "gluetun"] as const;
        const idx = vpns.indexOf(ws.vpnMode as (typeof vpns)[number]);
        ws.setVpnMode(vpns[(idx + 1) % vpns.length]);
        return;
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

    // Ctrl+R regenerates the password, but only when the password field
    // itself is focused — PasswordInput handles that locally. No handler
    // here so bare "r" never leaks into unrelated fields.
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
        onRegenerate={() => ws.setAdminPassword(generatePassword())}
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
        isFocused={activeSectionIndex === SEC_SYSTEM}
        focusedField={systemFocusedField}
      />

      {/* Status strip */}
      <Box marginTop={0}>
        <StatusStrip
          diskInfo={ws.diskInfo}
          dockerOk={ws.dockerOk}
          portsOk={ws.portsOk}
          gpuName={ws.detectedGpus.find((g) => g.vendor === ws.gpuVendor)?.name}
          caddyHttpPort={ws.caddyHttpPort}
          caddyHttpsPort={ws.caddyHttpsPort}
          portConflicts={ws.portConflicts}
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
          <Text color={colors.muted}>↑↓</Text>
          <Text color={colors.muted} dimColor>navigate</Text>
          <Text color={colors.muted}> ←→</Text>
          <Text color={colors.muted} dimColor>options</Text>
          <Text color={colors.muted}> Space</Text>
          <Text color={colors.muted} dimColor>select</Text>
          <Text color={colors.muted}> Enter</Text>
          <Text color={colors.muted} dimColor>install</Text>
          <Text color={colors.muted}> Esc</Text>
          <Text color={colors.muted} dimColor>quit</Text>
        </Box>
      </Box>
    </Box>
  );
}
