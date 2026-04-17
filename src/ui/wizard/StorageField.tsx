/** @jsxImportSource react */
import React from "react";
import { Box } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
import { TextInput } from "../shared/TextInput.js";

interface StorageFieldProps {
  storageRoot: string;
  extraPaths: string;
  onStorageRootChange: (val: string) => void;
  onExtraPathsChange: (val: string) => void;
  focusedField: number; // 0 = storage root, 1 = extra paths, -1 = none
}

export function StorageField({
  storageRoot,
  extraPaths,
  onStorageRootChange,
  onExtraPathsChange,
  focusedField,
}: StorageFieldProps) {
  return (
    <Box flexDirection="column">
      <SectionHeader title="STORAGE" />
      <Box flexDirection="column" marginTop={1}>
        <TextInput
          label="Storage root"
          value={storageRoot}
          onChange={onStorageRootChange}
          hint="First path: downloads + new media. Others: scanned for existing libraries."
          isFocused={focusedField === 0}
        />
        <TextInput
          label="Extra scan paths"
          value={extraPaths}
          onChange={onExtraPathsChange}
          hint="Comma-separated, e.g. /mnt/hdd1, /mnt/hdd3"
          isFocused={focusedField === 1}
        />
      </Box>
    </Box>
  );
}
