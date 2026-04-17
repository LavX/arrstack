/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { Form } from "../../../src/ui/wizard/Form.js";

describe("Form", () => {
  test("Form renders all section headers", () => {
    const { lastFrame } = render(<Form isReconfigure={false} onSubmit={() => {}} />);
    const frame = lastFrame()!;
    expect(frame).toContain("STORAGE");
    expect(frame).toContain("ADMIN");
    expect(frame).toContain("SERVICES");
    expect(frame).toContain("REMOTE");
    expect(frame).toContain("SYSTEM");
    expect(frame).toContain("Install");
  });

  test("Form renders with reconfigure label", () => {
    const { lastFrame } = render(<Form isReconfigure={true} onSubmit={() => {}} />);
    expect(lastFrame()!).toContain("Apply changes");
  });
});
