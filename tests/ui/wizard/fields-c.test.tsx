/** @jsxImportSource react */
import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { LocalDnsField } from "../../../src/ui/wizard/LocalDnsField.js";
import { SystemField } from "../../../src/ui/wizard/SystemField.js";
import { VpnField } from "../../../src/ui/wizard/VpnField.js";
import { StatusStrip } from "../../../src/ui/wizard/StatusStrip.js";

describe("LocalDnsField", () => {
  test("renders LOCAL HOSTNAMES section header", () => {
    const { lastFrame } = render(
      <LocalDnsField
        enabled={false}
        tld="arrstack.local"
        installDnsmasq={true}
        onEnabledChange={() => {}}
        onInstallDnsmasqChange={() => {}}
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
        installDnsmasq={true}
        onEnabledChange={() => {}}
        onInstallDnsmasqChange={() => {}}
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
        installDnsmasq={true}
        onEnabledChange={() => {}}
        onInstallDnsmasqChange={() => {}}
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
        installDnsmasq={true}
        onEnabledChange={() => {}}
        onInstallDnsmasqChange={() => {}}
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
        installDnsmasq={true}
        onEnabledChange={() => {}}
        onInstallDnsmasqChange={() => {}}
        onTldChange={() => {}}
        isFocused={true}
        focusedField={0}
      />
    );
    expect(lastFrame()).toContain("[x]");
  });
});

describe("SystemField", () => {
  const baseSystemProps = {
    timezone: "Europe/Budapest",
    puid: 1000,
    pgid: 1000,
    subtitleLanguages: "en",
    onTimezoneChange: () => {},
    onPuidChange: () => {},
    onSubtitleLanguagesChange: () => {},
    isFocused: false,
    focusedField: -1,
  };

  test("renders SYSTEM section header", () => {
    const { lastFrame } = render(<SystemField {...baseSystemProps} />);
    expect(lastFrame()).toContain("SYSTEM");
  });

  test("renders timezone value", () => {
    const { lastFrame } = render(<SystemField {...baseSystemProps} />);
    expect(lastFrame()).toContain("Europe/Budapest");
  });

  test("renders PUID/PGID as combined field", () => {
    const { lastFrame } = render(<SystemField {...baseSystemProps} />);
    expect(lastFrame()).toContain("1000/1000");
  });

  test("does not render the VPN radio (moved to VpnField)", () => {
    const { lastFrame } = render(<SystemField {...baseSystemProps} />);
    expect(lastFrame()).not.toContain("gluetun+wireguard");
  });
});

describe("VpnField", () => {
  const baseVpnProps = {
    mode: "none" as const,
    provider: "mullvad" as const,
    privateKey: "",
    addresses: "",
    countries: "",
    endpointIp: "",
    endpointPort: "",
    serverPublicKey: "",
    onPrivateKeyChange: () => {},
    onAddressesChange: () => {},
    onCountriesChange: () => {},
    onEndpointIpChange: () => {},
    onEndpointPortChange: () => {},
    onServerPublicKeyChange: () => {},
    isFocused: false,
    focusedField: -1,
  };

  test("renders VPN section header and mode radio", () => {
    const { lastFrame } = render(<VpnField {...baseVpnProps} />);
    expect(lastFrame()).toContain("VPN");
    expect(lastFrame()).toContain("gluetun+wireguard");
  });

  test("hides credential fields when mode=none", () => {
    const { lastFrame } = render(<VpnField {...baseVpnProps} />);
    expect(lastFrame()).not.toContain("WG private key");
    expect(lastFrame()).not.toContain("Provider");
  });

  test("shows provider + credentials when mode=gluetun", () => {
    const { lastFrame } = render(<VpnField {...baseVpnProps} mode="gluetun" />);
    expect(lastFrame()).toContain("Provider");
    expect(lastFrame()).toContain("mullvad");
    expect(lastFrame()).toContain("WG private key");
    expect(lastFrame()).toContain("WG addresses");
  });

  test("reveals custom endpoint fields only when provider=custom", () => {
    const nonCustom = render(<VpnField {...baseVpnProps} mode="gluetun" provider="mullvad" />);
    expect(nonCustom.lastFrame()).not.toContain("Endpoint IP");

    const custom = render(<VpnField {...baseVpnProps} mode="gluetun" provider="custom" />);
    expect(custom.lastFrame()).toContain("Endpoint IP");
    expect(custom.lastFrame()).toContain("Endpoint port");
    expect(custom.lastFrame()).toContain("Server pubkey");
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
