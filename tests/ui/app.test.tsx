/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/ui/App.js";

describe("App", () => {
  test("renders without crashing", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("arrstack");
  });
});
