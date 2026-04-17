/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../shared/theme.js";

interface StatusStripProps {
  diskInfo: Array<{ path: string; freeGb: number }>;
  dockerOk: boolean;
  portsOk: boolean;
  gpuName?: string;
  caddyHttpPort?: number;
  caddyHttpsPort?: number;
  portConflicts?: string[];
}

export function StatusStrip({ diskInfo, dockerOk, portsOk, gpuName, caddyHttpPort, caddyHttpsPort, portConflicts }: StatusStripProps) {
  const caddyNote = (!portsOk && caddyHttpPort && caddyHttpsPort)
    ? `Caddy:${caddyHttpPort}/${caddyHttpsPort}`
    : portsOk ? "80/443:free" : "80/443:in use";

  return (
    <Box flexDirection="column">
      <Text color={colors.muted}>
        {diskInfo.map((d) => `${d.path}:${d.freeGb}G`).join("  ")}
        {diskInfo.length > 0 && "  "}
        Docker:{dockerOk ? <Text color="green">ok</Text> : <Text color="red">missing</Text>}
        {"  "}
        {caddyNote}
        {gpuName ? `  GPU:${gpuName}` : ""}
      </Text>
      {portConflicts && portConflicts.length > 0 && (
        <Text color="yellow">Port remaps: {portConflicts.join(", ")}</Text>
      )}
    </Box>
  );
}
