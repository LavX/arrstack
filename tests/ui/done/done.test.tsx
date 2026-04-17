/** @jsxImportSource react */
import { test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { DoneScreen } from "../../../src/ui/done/DoneScreen.js";

test("DoneScreen shows admin credentials and URLs", () => {
  const { lastFrame } = render(
    <DoneScreen
      adminUser="admin"
      password="k3d4-W2q8"
      urls={[{ name: "Sonarr", url: "http://192.168.1.1:8989", description: "tv shows" }]}
    />
  );
  const frame = lastFrame()!;
  expect(frame).toContain("arrstack is running");
  expect(frame).toContain("admin");
  expect(frame).toContain("k3d4-W2q8");
  expect(frame).toContain("Sonarr");
  expect(frame).toContain("8989");
});
