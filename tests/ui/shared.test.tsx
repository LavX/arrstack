/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { TextInput } from "../../src/ui/shared/TextInput.js";
import { CheckboxGrid } from "../../src/ui/shared/Checkbox.js";
import { Radio } from "../../src/ui/shared/Radio.js";
import { SectionHeader } from "../../src/ui/shared/SectionHeader.js";

describe("shared components", () => {
  test("TextInput renders label and value", () => {
    const { lastFrame } = render(
      <TextInput label="Storage root" value="/data" onChange={() => {}} isFocused={false} />
    );
    expect(lastFrame()).toContain("Storage root");
    expect(lastFrame()).toContain("/data");
  });

  test("CheckboxGrid renders items", () => {
    const { lastFrame } = render(
      <CheckboxGrid
        items={[{ id: "sonarr", label: "Sonarr", checked: true, port: 8989 }]}
        onChange={() => {}}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("Sonarr");
    expect(lastFrame()).toContain("\u25A0");
  });

  test("Radio renders selected option", () => {
    const { lastFrame } = render(
      <Radio
        options={[{ value: "none", label: "None" }, { value: "duckdns", label: "DuckDNS" }]}
        selected="none"
        onChange={() => {}}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("None");
    expect(lastFrame()).toContain("DuckDNS");
  });

  test("SectionHeader renders title", () => {
    const { lastFrame } = render(<SectionHeader title="STORAGE" />);
    expect(lastFrame()).toContain("STORAGE");
  });
});
