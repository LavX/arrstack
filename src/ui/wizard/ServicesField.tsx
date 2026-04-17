/** @jsxImportSource react */
import React from "react";
import { Box } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
import { CheckboxGrid, CheckboxItem } from "../shared/Checkbox.js";

interface ServicesFieldProps {
  services: Array<{
    id: string;
    name: string;
    checked: boolean;
    port?: number;
    description?: string;
  }>;
  onChange: (id: string) => void;
  isFocused: boolean;
  focusedIndex: number;
}

export function ServicesField({
  services,
  onChange,
  focusedIndex,
}: ServicesFieldProps) {
  const items: CheckboxItem[] = services.map((svc) => ({
    id: svc.id,
    label: svc.name,
    checked: svc.checked,
    port: svc.port,
    description: svc.description,
  }));

  return (
    <Box flexDirection="column">
      <SectionHeader title="SERVICES" hint="(space = toggle, a = all, n = none)" />
      <Box flexDirection="column" marginTop={1}>
        <CheckboxGrid
          items={items}
          onChange={onChange}
          focusedIndex={focusedIndex}
          columns={4}
        />
      </Box>
    </Box>
  );
}
