/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

export interface CheckboxItem {
  id: string;
  label: string;
  checked: boolean;
  port?: number;
  description?: string;
}

interface Props {
  items: CheckboxItem[];
  onChange: (id: string) => void;
  focusedIndex: number;
  columns?: number;
}

export function CheckboxGrid({ items, focusedIndex, columns = 4 }: Props) {
  const rows: CheckboxItem[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx} flexDirection="row">
          {row.map((item) => {
            const idx = items.indexOf(item);
            const focused = idx === focusedIndex;
            const mark = item.checked ? "x" : " ";
            return (
              <Box key={item.id} marginRight={2}>
                <Text color={focused ? colors.accent : undefined}>
                  [{mark}] {item.label}
                </Text>
                {item.port !== undefined && (
                  <Text color={colors.muted}> :{item.port}</Text>
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
