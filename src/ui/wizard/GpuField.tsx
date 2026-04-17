/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
import { Radio, RadioOption } from "../shared/Radio.js";
import { colors } from "../shared/theme.js";

interface GpuFieldProps {
  detectedGpus: Array<{ vendor: string; name: string }>;
  selected: string; // "none" | "intel" | "amd" | "nvidia"
  onChange: (val: string) => void;
  isFocused: boolean;
  focusedIndex: number;
}

export function GpuField({
  detectedGpus,
  selected,
  onChange,
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

  return (
    <Box flexDirection="column">
      <SectionHeader title="HARDWARE TRANSCODING" hint="(auto-detected)" />
      <Box flexDirection="column" marginTop={1}>
        {hasGpu ? (
          <>
            {detectedGpus.map((gpu, idx) => (
              <Text key={idx} color={colors.highlight}>
                Detected: {gpu.name}
              </Text>
            ))}
            <Box marginTop={1}>
              <Radio
                options={options}
                selected={selected}
                onChange={onChange}
                focusedIndex={focusedIndex}
              />
            </Box>
          </>
        ) : (
          <>
            <Text color={colors.muted}>No GPU detected, using CPU only</Text>
            <Box marginTop={1}>
              <Radio
                options={options}
                selected={selected}
                onChange={onChange}
                focusedIndex={focusedIndex}
              />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
