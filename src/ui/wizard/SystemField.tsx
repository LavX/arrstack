/** @jsxImportSource react */
import React from "react";
import { Box } from "ink";
import { SectionBox } from "../shared/SectionBox.js";
import { TextInput } from "../shared/TextInput.js";

interface SystemFieldProps {
  timezone: string;
  puid: number;
  pgid: number;
  subtitleLanguages: string; // comma-separated ISO 639-1 codes, e.g. "en, hu"
  onTimezoneChange: (val: string) => void;
  onPuidChange: (val: string) => void;
  onSubtitleLanguagesChange: (val: string) => void;
  isFocused: boolean;
  focusedField: number; // 0=tz, 1=uid/gid, 2=subs langs
}

export function SystemField({
  timezone,
  puid,
  pgid,
  subtitleLanguages,
  onTimezoneChange,
  onPuidChange,
  onSubtitleLanguagesChange,
  isFocused,
  focusedField,
}: SystemFieldProps) {
  const puidPgid = `${puid}/${pgid}`;

  return (
    <SectionBox title="SYSTEM" isFocused={isFocused}>
      <Box>
        <TextInput
          label="Timezone"
          value={timezone}
          onChange={onTimezoneChange}
          isFocused={focusedField === 0}
        />
      </Box>
      <Box>
        <TextInput
          label="UID/GID"
          value={puidPgid}
          onChange={onPuidChange}
          isFocused={focusedField === 1}
        />
      </Box>
      <Box>
        <TextInput
          label="Subtitle langs"
          value={subtitleLanguages}
          onChange={onSubtitleLanguagesChange}
          hint="comma-separated ISO codes (e.g. en,hu)"
          isFocused={focusedField === 2}
        />
      </Box>
    </SectionBox>
  );
}
