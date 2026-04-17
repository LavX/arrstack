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
  locked?: boolean;
}

interface Props {
  items: CheckboxItem[];
  onChange: (id: string) => void;
  focusedIndex: number;
  columns?: number;
}

const COL_WIDTH = 24;

export function CheckboxGrid({ items, focusedIndex, columns = 3 }: Props) {
  const rows: CheckboxItem[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((item) => {
            const idx = items.indexOf(item);
            const focused = idx === focusedIndex;
            const mark = item.locked ? "\u25A0" : item.checked ? "\u25A0" : "\u25A1";
            const portStr = item.port ? `:${item.port}` : "";
            const cellText = `${mark} ${item.label}${portStr}`;
            const dimmed = item.locked;
            return (
              <Box key={item.id} width={COL_WIDTH}>
                <Text
                  color={focused ? colors.accent : dimmed ? colors.muted : undefined}
                  bold={focused}
                  dimColor={dimmed && !focused}
                >
                  {focused ? `▸${cellText}` : ` ${cellText}`}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
