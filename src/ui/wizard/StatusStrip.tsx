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
  return (
    <Box>
      <Text color={colors.muted}>
        {diskInfo.map((d) => `${d.path}:${d.freeGb}G`).join("  ")}
        {diskInfo.length > 0 && "  "}
        Docker:{dockerOk ? "ok" : "missing"}
        {"  "}
        80/443:{portsOk ? "free" : "in use"}
        {gpuName ? `  GPU:${gpuName}` : ""}
      </Text>
    </Box>
  );
}
