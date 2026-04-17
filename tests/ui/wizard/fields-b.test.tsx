/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { ServicesField } from "../../../src/ui/wizard/ServicesField.js";
import { RemoteAccessField } from "../../../src/ui/wizard/RemoteAccessField.js";

describe("ServicesField", () => {
  test("renders service names with checkboxes", () => {
    const services = [
      { id: "sonarr", name: "Sonarr", checked: true, port: 8989 },
      { id: "radarr", name: "Radarr", checked: false, port: 7878 },
      { id: "lidarr", name: "Lidarr", checked: true, port: 8686 },
    ];
    const { lastFrame } = render(
      <ServicesField
        services={services}
        onChange={() => {}}
        isFocused={false}
        focusedIndex={0}
      />
    );
    expect(lastFrame()).toContain("Sonarr");
    expect(lastFrame()).toContain("Radarr");
    expect(lastFrame()).toContain("Lidarr");
  });
});

describe("RemoteAccessField", () => {
  test("renders mode radio with three options", () => {
    const { lastFrame } = render(
      <RemoteAccessField
        mode="none"
        domain=""
        token=""
        onModeChange={() => {}}
        onDomainChange={() => {}}
        onTokenChange={() => {}}
        isFocused={false}
        focusedField={0}
      />
    );
    expect(lastFrame()).toContain("None");
    expect(lastFrame()).toContain("DuckDNS");
    expect(lastFrame()).toContain("Cloudflare");
  });

  test("shows domain input when cloudflare selected", () => {
    const { lastFrame } = render(
      <RemoteAccessField
        mode="cloudflare"
        domain="arr.lavx.hu"
        token=""
        onModeChange={() => {}}
        onDomainChange={() => {}}
        onTokenChange={() => {}}
        isFocused={true}
        focusedField={1}
      />
    );
    expect(lastFrame()).toContain("Domain");
  });
});
