/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { colors, LABEL_WIDTH } from "../shared/theme.js";

interface AdminFieldProps {
  username: string;
  password: string;
  onUsernameChange: (val: string) => void;
  onPasswordChange: (val: string) => void;
  focusedField: number; // 0 = username, 1 = password, -1 = none
}

export function AdminField({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  focusedField,
}: AdminFieldProps) {
  const maskedPassword = password.replace(/./g, "\u25CF");

  return (
    <SectionBox title="ADMIN" isFocused={focusedField >= 0}>
      <TextInput
        label="Username"
        value={username}
        onChange={onUsernameChange}
        isFocused={focusedField === 0}
      />
      <Box>
        <Text color={focusedField === 1 ? colors.accent : "white"}>
          {"Password".padEnd(LABEL_WIDTH)}
        </Text>
        {focusedField === 1 ? (
          <Text>{password}</Text>
        ) : (
          <Text color={colors.value}>{maskedPassword}</Text>
        )}
        <Text color={colors.muted}>  (r to regenerate)</Text>
      </Box>
    </SectionBox>
  );
}
