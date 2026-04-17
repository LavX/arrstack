/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { StorageField } from "../../../src/ui/wizard/StorageField.js";
import { AdminField } from "../../../src/ui/wizard/AdminField.js";
import { GpuField } from "../../../src/ui/wizard/GpuField.js";

describe("StorageField", () => {
  test("renders storage root label and default value", () => {
    const { lastFrame } = render(
      <StorageField
        storageRoot="/data"
        extraPaths=""
        onStorageRootChange={() => {}}
        onExtraPathsChange={() => {}}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("STORAGE");
    expect(lastFrame()).toContain("/data");
  });

  test("renders extra scan paths label", () => {
    const { lastFrame } = render(
      <StorageField
        storageRoot="/data"
        extraPaths="/mnt/hdd1"
        onStorageRootChange={() => {}}
        onExtraPathsChange={() => {}}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("Extra scan paths");
    expect(lastFrame()).toContain("/mnt/hdd1");
  });
});

describe("AdminField", () => {
  test("renders username and masked password", () => {
    const { lastFrame } = render(
      <AdminField
        username="admin"
        password="test-pass"
        onUsernameChange={() => {}}
        onPasswordChange={() => {}}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("ADMIN");
    expect(lastFrame()).toContain("admin");
  });

  test("shows actual password when password field is focused", () => {
    const { lastFrame } = render(
      <AdminField
        username="admin"
        password="test-pass"
        onUsernameChange={() => {}}
        onPasswordChange={() => {}}
        focusedField={1}
      />
    );
    expect(lastFrame()).toContain("test-pass");
  });

  test("shows masked password when not focused", () => {
    const { lastFrame } = render(
      <AdminField
        username="admin"
        password="test-pass"
        onUsernameChange={() => {}}
        onPasswordChange={() => {}}
        focusedField={-1}
      />
    );
    // password should be masked with middle dots
    expect(lastFrame()).not.toContain("test-pass");
  });
});

describe("GpuField", () => {
  test("renders detected GPU name", () => {
    const { lastFrame } = render(
      <GpuField
        detectedGpus={[{ vendor: "intel", name: "UHD 630" }]}
        selected="none"
        onChange={() => {}}
        isFocused={false}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("UHD 630");
  });

  test("renders CPU only when no GPU", () => {
    const { lastFrame } = render(
      <GpuField
        detectedGpus={[]}
        selected="none"
        onChange={() => {}}
        isFocused={false}
        focusedIndex={0}
      />
    );
    const frame = lastFrame() ?? "";
    expect(frame.includes("CPU only") || frame.includes("No GPU")).toBe(true);
  });

  test("renders Intel QSV option when Intel GPU detected", () => {
    const { lastFrame } = render(
      <GpuField
        detectedGpus={[{ vendor: "intel", name: "UHD 630" }]}
        selected="none"
        onChange={() => {}}
        isFocused={false}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("Intel QSV");
  });

  test("renders NVIDIA NVENC option when NVIDIA GPU detected", () => {
    const { lastFrame } = render(
      <GpuField
        detectedGpus={[{ vendor: "nvidia", name: "RTX 3080" }]}
        selected="none"
        onChange={() => {}}
        isFocused={false}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("NVIDIA NVENC");
  });

  test("renders HARDWARE TRANSCODING section header", () => {
    const { lastFrame } = render(
      <GpuField
        detectedGpus={[]}
        selected="none"
        onChange={() => {}}
        isFocused={false}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("HARDWARE TRANSCODING");
  });
});
