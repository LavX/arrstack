/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { Radio, RadioOption } from "../shared/Radio.js";
import { colors } from "../shared/theme.js";

export type GpuVendor = "none" | "intel" | "amd" | "nvidia";

interface GpuFieldProps {
  detectedGpus: Array<{ vendor: string; name: string }>;
  selected: GpuVendor;
  onChange: (val: GpuVendor) => void;
  isFocused: boolean;
  focusedIndex: number;
}

export function GpuField({
  detectedGpus,
  selected,
  isFocused,
  focusedIndex,
}: GpuFieldProps) {
  const hasGpu = detectedGpus.length > 0;

  const options: RadioOption[] = [{ value: "none", label: "CPU only (software)" }];

  if (detectedGpus.some((g) => g.vendor.toLowerCase() === "intel")) {
    options.push({ value: "intel", label: "Intel QSV / VAAPI" });
  }
  if (detectedGpus.some((g) => g.vendor.toLowerCase() === "amd")) {
    options.push({ value: "amd", label: "AMD VAAPI" });
  }
  if (detectedGpus.some((g) => g.vendor.toLowerCase() === "nvidia")) {
    options.push({ value: "nvidia", label: "NVIDIA NVENC" });
  }

  const gpuNames = detectedGpus.map((g) => g.name).join(" \u00B7 ");
  const hint = hasGpu ? "(auto-detected)" : undefined;

  return (
    <SectionBox title="HARDWARE TRANSCODING" hint={hint} isFocused={isFocused}>
      {hasGpu ? (
        <Text color={colors.highlight}>{gpuNames}</Text>
      ) : (
        <Text color={colors.muted}>No GPU detected, using CPU only</Text>
      )}
      <Box>
        <Radio
          options={options}
          selected={selected}
          focusedIndex={focusedIndex}
          inline={options.length <= 3}
        />
      </Box>
    </SectionBox>
  );
}
