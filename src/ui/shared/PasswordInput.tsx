/** @jsxImportSource react */
import React from "react";
import { Text, useInput } from "ink";

export interface PasswordInputProps {
  value: string;
  onChange: (val: string) => void;
  onRegenerate: () => void;
  isFocused: boolean;
}

/**
 * Custom password text input for Ink that properly handles Ctrl+R
 * as a regenerate action instead of typing "r" into the field.
 *
 * When Ctrl+R is pressed, ink delivers input="r" with key.ctrl=true.
 * The stock ink-text-input only guards against Ctrl+C, so Ctrl+R falls
 * through to its text insertion branch and types "r". This component
 * intercepts it before that can happen.
 *
 * Navigation keys (arrows, Tab, Enter, Escape) are intentionally not
 * consumed, allowing the parent Form useInput handler to process them.
 */
export function PasswordInput({
  value,
  onChange,
  onRegenerate,
  isFocused,
}: PasswordInputProps) {
  useInput(
    (input: string, key) => {
      // Ctrl+R triggers regenerate, not character input
      if (key.ctrl && input === "r") {
        onRegenerate();
        return;
      }

      // Let navigation keys pass through to Form's useInput handler
      if (
        key.upArrow ||
        key.downArrow ||
        key.leftArrow ||
        key.rightArrow ||
        key.tab ||
        key.return ||
        key.escape
      ) {
        return;
      }

      // Backspace / Delete: remove last character
      if (key.backspace || key.delete) {
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        }
        return;
      }

      // Block all other ctrl/meta combos from inserting stray characters
      if (key.ctrl || key.meta) {
        return;
      }

      // Regular printable character: append to value
      if (input.length > 0) {
        onChange(value + input);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Text>
      {value}
      {isFocused ? <Text inverse> </Text> : null}
    </Text>
  );
}
