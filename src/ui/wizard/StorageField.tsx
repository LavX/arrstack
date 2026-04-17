/** @jsxImportSource react */
import React from "react";
import { Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { colors } from "../shared/theme.js";

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
    <SectionBox title="STORAGE" isFocused={focusedField >= 0}>
      <TextInput
        label="Storage root"
        value={storageRoot}
        onChange={onStorageRootChange}
        isFocused={focusedField === 0}
      />
      <TextInput
        label="Extra scan paths"
        value={extraPaths}
        onChange={onExtraPathsChange}
        isFocused={focusedField === 1}
      />
      <Text color={colors.muted}>First path is for downloads + new media.</Text>
    </SectionBox>
  );
}
