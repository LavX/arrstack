/** @jsxImportSource react */
import React from "react";
import { Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
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
  isFocused,
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
    <SectionBox title="SERVICES" hint="(space toggle, a/n all)" isFocused={isFocused}>
      <CheckboxGrid
        items={items}
        onChange={onChange}
        focusedIndex={focusedIndex}
        columns={3}
      />
      {isFocused && focusedIndex >= 0 && items[focusedIndex]?.description && (
        <Text color="gray" dimColor>{"  "}{items[focusedIndex].description}</Text>
      )}
    </SectionBox>
  );
}
