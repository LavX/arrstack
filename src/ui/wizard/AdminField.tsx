/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";
import InkTextInput from "ink-text-input";
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
  const maskedPassword = "\u25CF".repeat(password.length);
  const isPasswordFocused = focusedField === 1;

  return (
    <SectionBox title="ADMIN" isFocused={focusedField >= 0}>
      <TextInput
        label="Username"
        value={username}
        onChange={onUsernameChange}
        isFocused={focusedField === 0}
      />
      <Box>
        <Text color={isPasswordFocused ? colors.accent : "white"}>
          {"Password".padEnd(LABEL_WIDTH)}
        </Text>
        {isPasswordFocused ? (
          <>
            <InkTextInput value={password} onChange={onPasswordChange} />
            <Text color={colors.muted}>{"  (r to regenerate)"}</Text>
          </>
        ) : (
          <>
            <Text color={colors.value}>{maskedPassword}</Text>
            <Text color={colors.muted}>{"  (" + password.length + " chars)"}</Text>
          </>
        )}
      </Box>
    </SectionBox>
  );
}
