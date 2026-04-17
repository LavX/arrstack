/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { LocalDnsField } from "../../../src/ui/wizard/LocalDnsField.js";
import { SystemField } from "../../../src/ui/wizard/SystemField.js";
import { StatusStrip } from "../../../src/ui/wizard/StatusStrip.js";

describe("LocalDnsField", () => {
  test("renders LOCAL HOSTNAMES section header", () => {
    const { lastFrame } = render(
      <LocalDnsField
        enabled={false}
        tld="arrstack.local"
        onEnabledChange={() => {}}
        onTldChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("LOCAL HOSTNAMES");
  });

  test("renders Install local DNS checkbox", () => {
    const { lastFrame } = render(
      <LocalDnsField
        enabled={false}
        tld="arrstack.local"
        onEnabledChange={() => {}}
        onTldChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("Install local DNS");
  });

  test("shows TLD input when enabled", () => {
    const { lastFrame } = render(
      <LocalDnsField
        enabled={true}
        tld="arrstack.local"
        onEnabledChange={() => {}}
        onTldChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("arrstack.local");
  });

  test("hides TLD input when disabled", () => {
    const { lastFrame } = render(
      <LocalDnsField
        enabled={false}
        tld="arrstack.local"
        onEnabledChange={() => {}}
        onTldChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).not.toContain("arrstack.local");
  });

  test("shows checked state when enabled", () => {
    const { lastFrame } = render(
      <LocalDnsField
        enabled={true}
        tld="arrstack.local"
        onEnabledChange={() => {}}
        onTldChange={() => {}}
        isFocused={true}
        focusedField={0}
      />
    );
    expect(lastFrame()).toContain("[x]");
  });
});

describe("SystemField", () => {
  test("renders SYSTEM section header", () => {
    const { lastFrame } = render(
      <SystemField
        timezone="Europe/Budapest"
        puid={1000}
        pgid={1000}
        vpnMode="none"
        onTimezoneChange={() => {}}
        onPuidChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("SYSTEM");
  });

  test("renders timezone value", () => {
    const { lastFrame } = render(
      <SystemField
        timezone="Europe/Budapest"
        puid={1000}
        pgid={1000}
        vpnMode="none"
        onTimezoneChange={() => {}}
        onPuidChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("Europe/Budapest");
  });

  test("renders PUID/PGID as combined field", () => {
    const { lastFrame } = render(
      <SystemField
        timezone="Europe/Budapest"
        puid={1000}
        pgid={1000}
        vpnMode="none"
        onTimezoneChange={() => {}}
        onPuidChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("1000/1000");
  });

  test("renders VPN radio options", () => {
    const { lastFrame } = render(
      <SystemField
        timezone="UTC"
        puid={1000}
        pgid={1000}
        vpnMode="none"
        onTimezoneChange={() => {}}
        onPuidChange={() => {}}
        isFocused={false}
        focusedField={-1}
      />
    );
    expect(lastFrame()).toContain("gluetun+wireguard");
  });
});

describe("StatusStrip", () => {
  test("renders disk info paths and sizes", () => {
    const { lastFrame } = render(
      <StatusStrip
        diskInfo={[
          { path: "/data", freeGb: 847 },
          { path: "/mnt/hdd1", freeGb: 342 },
        ]}
        dockerOk={true}
        portsOk={true}
      />
    );
    expect(lastFrame()).toContain("/data:847G");
    expect(lastFrame()).toContain("/mnt/hdd1:342G");
  });

  test("renders Docker ok status", () => {
    const { lastFrame } = render(
      <StatusStrip
        diskInfo={[{ path: "/data", freeGb: 100 }]}
        dockerOk={true}
        portsOk={true}
      />
    );
    expect(lastFrame()).toContain("Docker:ok");
  });

  test("renders Docker missing when not ok", () => {
    const { lastFrame } = render(
      <StatusStrip
        diskInfo={[{ path: "/data", freeGb: 100 }]}
        dockerOk={false}
        portsOk={true}
      />
    );
    expect(lastFrame()).toContain("Docker:missing");
  });

  test("renders ports free status", () => {
    const { lastFrame } = render(
      <StatusStrip
        diskInfo={[{ path: "/data", freeGb: 100 }]}
        dockerOk={true}
        portsOk={true}
      />
    );
    expect(lastFrame()).toContain("80/443:free");
  });

  test("renders GPU name when provided", () => {
    const { lastFrame } = render(
      <StatusStrip
        diskInfo={[{ path: "/data", freeGb: 100 }]}
        dockerOk={true}
        portsOk={true}
        gpuName="Intel/vaapi"
      />
    );
    expect(lastFrame()).toContain("GPU:Intel/vaapi");
  });

  test("does not render GPU section when not provided", () => {
    const { lastFrame } = render(
      <StatusStrip
        diskInfo={[{ path: "/data", freeGb: 100 }]}
        dockerOk={true}
        portsOk={true}
      />
    );
    expect(lastFrame()).not.toContain("GPU:");
  });
});
