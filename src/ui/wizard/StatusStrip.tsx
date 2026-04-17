/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../shared/theme.js";

interface StatusStripProps {
  diskInfo: Array<{ path: string; freeGb: number }>;
  dockerOk: boolean;
  portsOk: boolean;
  gpuName?: string;
}

export function StatusStrip({ diskInfo, dockerOk, portsOk, gpuName }: StatusStripProps) {
  const parts: string[] = [];

  for (const disk of diskInfo) {
    parts.push(`${disk.path}:${disk.freeGb}G`);
  }

  parts.push(`Docker:${dockerOk ? "ok" : "missing"}`);
  parts.push(`80/443:${portsOk ? "free" : "in use"}`);

  if (gpuName) {
    parts.push(`GPU:${gpuName}`);
  }

  return (
    <Box>
      <Text color={colors.muted}>{parts.join(" | ")}</Text>
    </Box>
  );
}
