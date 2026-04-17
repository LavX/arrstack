/** @jsxImportSource react */
import React from "react";
import { Box, Text, useInput } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";
import { colors, LABEL_WIDTH } from "../shared/theme.js";
import { generatePassword } from "../../lib/random.js";

interface AdminFieldProps {
  username: string;
  password: string;
  onUsernameChange: (val: string) => void;
  onPasswordChange: (val: string) => void;
  focusedField: number; // 0 = username, 1 = password, -1 = none
}

function PasswordInput({
  value,
  onChange,
  onRegenerate,
  isFocused,
}: {
  value: string;
  onChange: (val: string) => void;
  onRegenerate: () => void;
  isFocused: boolean;
}) {
  useInput(
    (input, key) => {
      if (!isFocused) return;

      // Ctrl+R: regenerate
      if (key.ctrl && !key.shift && !key.meta) {
        // Ctrl+R arrives as input === "\x12"
        if (input === "\x12" || input === "r" || input === "R") {
          onRegenerate();
          return;
        }
      }

      // Backspace / Delete
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }

      // Ignore control sequences, arrows, etc.
      if (key.ctrl || key.meta || key.escape || key.tab || key.return) return;
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;

      // Regular character: append
      if (input && input.length === 1 && input >= " ") {
        onChange(value + input);
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box>
      <Text color={colors.value}>{value}</Text>
      {isFocused && <Text color={colors.accent}>{"█"}</Text>}
    </Box>
  );
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
            <PasswordInput
              value={password}
              onChange={onPasswordChange}
              onRegenerate={() => onPasswordChange(generatePassword())}
              isFocused={true}
            />
            <Text color={colors.muted}>{"  Ctrl+R regenerate"}</Text>
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
