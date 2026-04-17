/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "../shared/SectionHeader.js";
import { TextInput } from "../shared/TextInput.js";
import { colors } from "../shared/theme.js";

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
  const maskedPassword = password.replace(/./g, "\u00b7");

  return (
    <Box flexDirection="column">
      <SectionHeader title="ADMIN ACCOUNT" hint="used by every service, change later in each UI" />
      <Box flexDirection="column" marginTop={1}>
        <TextInput
          label="Username"
          value={username}
          onChange={onUsernameChange}
          isFocused={focusedField === 0}
        />
        <TextInput
          label="Password"
          value={focusedField === 1 ? password : maskedPassword}
          onChange={onPasswordChange}
          isFocused={focusedField === 1}
        />
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.muted}>Tab to password field and press </Text>
          <Text color={colors.accent}>r</Text>
          <Text color={colors.muted}> to (regenerate)</Text>
        </Box>
      </Box>
    </Box>
  );
}
