/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { ProgressView } from "../../../src/ui/progress/ProgressView.js";

describe("ProgressView", () => {
  test("renders step in done state with checkmark", () => {
    const { lastFrame } = render(
      <ProgressView steps={[{ step: "Pulling images", status: "done", durationMs: 1200 }]} />
    );
    expect(lastFrame()!).toContain("ok");
    expect(lastFrame()!).toContain("Pulling images");
  });

  test("renders error message on failure", () => {
    const { lastFrame } = render(
      <ProgressView
        steps={[{ step: "Starting containers", status: "failed" }]}
        error="Port 8080 already in use"
      />
    );
    expect(lastFrame()!).toContain("failed");
    expect(lastFrame()!).toContain("Port 8080");
  });

  test("renders pending steps", () => {
    const { lastFrame } = render(
      <ProgressView steps={[
        { step: "Writing .env", status: "done", durationMs: 100 },
        { step: "Pulling images", status: "running" },
        { step: "Starting containers", status: "pending" },
      ]} />
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Writing .env");
    expect(frame).toContain("Pulling images");
    expect(frame).toContain("Starting containers");
  });
});
