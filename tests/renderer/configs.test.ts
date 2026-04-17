import { describe, expect, test } from "bun:test";
import { renderServarrConfig } from "../../src/renderer/servarr-config";
import { renderBazarrConfig } from "../../src/renderer/bazarr-config";
import { renderQbitConfig } from "../../src/renderer/qbit-config";
import { renderRecyclarrConfig } from "../../src/renderer/recyclarr-config";
import { renderJellyfinEncoding } from "../../src/renderer/jellyfin-encoding";
import { renderFirstRun } from "../../src/renderer/first-run";
import { renderDnsmasqConf } from "../../src/renderer/dnsmasq";
import { getServicesByIds } from "../../src/catalog";

describe("servarr-config.xml", () => {
  test("contains the API key", () => {
    const output = renderServarrConfig({ apiKey: "test-api-key-123" });
    expect(output).toContain("<ApiKey>test-api-key-123</ApiKey>");
  });

  test("has AuthenticationMethod Forms", () => {
    const output = renderServarrConfig({ apiKey: "key" });
    expect(output).toContain("<AuthenticationMethod>Forms</AuthenticationMethod>");
  });

  test("AuthenticationRequired is DisabledForLocalAddresses for LAN ease", () => {
    const output = renderServarrConfig({ apiKey: "key" });
    expect(output).toContain(
      "<AuthenticationRequired>DisabledForLocalAddresses</AuthenticationRequired>",
    );
  });
});

describe("bazarr config.yaml", () => {
  const opts = {
    username: "admin",
    passwordHash: "pbkdf2:deadbeef:cafef00d",
    sonarrApiKey: "sonarr-key",
    radarrApiKey: "radarr-key",
  };

  test("contains auth section with username and pbkdf2 password", () => {
    const output = renderBazarrConfig(opts);
    expect(output).toContain("username: admin");
    expect(output).toContain("password: pbkdf2:deadbeef:cafef00d");
  });

  test("use_sonarr and use_radarr are true", () => {
    const output = renderBazarrConfig(opts);
    expect(output).toContain("use_sonarr: true");
    expect(output).toContain("use_radarr: true");
  });

  test("sonarr section has correct ip and port", () => {
    const output = renderBazarrConfig(opts);
    expect(output).toContain("ip: sonarr");
    expect(output).toContain("port: 8989");
  });

  test("radarr section has correct ip and port", () => {
    const output = renderBazarrConfig(opts);
    expect(output).toContain("ip: radarr");
    expect(output).toContain("port: 7878");
  });

  test("enabled subtitle providers are listed", () => {
    const output = renderBazarrConfig(opts);
    expect(output).toContain("opensubtitles");
    expect(output).toContain("podnapisi");
    expect(output).toContain("embeddedsubtitles");
  });
});

describe("qbittorrent.conf", () => {
  const opts = {
    username: "admin",
    pbkdf2Hash: "@ByteArray(salt:hash)",
  };

  test("contains WebUI username", () => {
    const output = renderQbitConfig(opts);
    expect(output).toContain("WebUI\\Username=admin");
  });

  test("contains PBKDF2 password hash", () => {
    const output = renderQbitConfig(opts);
    expect(output).toContain("WebUI\\Password_PBKDF2=@ByteArray(salt:hash)");
  });

  test("WebUI port is 8080", () => {
    const output = renderQbitConfig(opts);
    expect(output).toContain("WebUI\\Port=8080");
  });

  test("default save path is /data/torrents", () => {
    const output = renderQbitConfig(opts);
    expect(output).toContain("DefaultSavePath=/data/torrents");
  });

  test("temp path is disabled", () => {
    const output = renderQbitConfig(opts);
    expect(output).toContain("TempPathEnabled=false");
  });
});

describe("recyclarr.yml", () => {
  const opts = {
    sonarrApiKey: "sonarr-api",
    radarrApiKey: "radarr-api",
  };

  test("sonarr base_url is correct", () => {
    const output = renderRecyclarrConfig(opts);
    expect(output).toContain("base_url: http://sonarr:8989");
  });

  test("radarr base_url is correct", () => {
    const output = renderRecyclarrConfig(opts);
    expect(output).toContain("base_url: http://radarr:7878");
  });

  test("sonarr api_key is set", () => {
    const output = renderRecyclarrConfig(opts);
    expect(output).toContain("api_key: sonarr-api");
  });

  test("sonarr section declares a WEB-1080p profile with cutoff", () => {
    const output = renderRecyclarrConfig(opts);
    expect(output).toContain("name: WEB-1080p");
    expect(output).toContain("until_quality: WEB 1080p");
    expect(output).toContain("type: series");
  });

  test("radarr section declares HD Bluray + WEB profile with cutoff", () => {
    const output = renderRecyclarrConfig(opts);
    expect(output).toContain("name: HD Bluray + WEB");
    expect(output).toContain("until_quality: Bluray-1080p");
    expect(output).toContain("type: movie");
  });

  test("instance names are unique across services (v8 constraint)", () => {
    const output = renderRecyclarrConfig(opts);
    // Must NOT use 'default' as instance name under both sonarr and radarr;
    // Recyclarr v8 rejects with 'Duplicate Instances: default'.
    expect(output).toContain("sonarr:\n  sonarr:");
    expect(output).toContain("radarr:\n  radarr:");
  });
});

describe("encoding.xml", () => {
  test("Intel GPU uses vaapi", () => {
    const output = renderJellyfinEncoding({ vendor: "intel" });
    expect(output).toContain("<HardwareAccelerationType>vaapi</HardwareAccelerationType>");
  });

  test("AMD GPU uses vaapi", () => {
    const output = renderJellyfinEncoding({ vendor: "amd" });
    expect(output).toContain("<HardwareAccelerationType>vaapi</HardwareAccelerationType>");
  });

  test("Nvidia GPU uses nvenc", () => {
    const output = renderJellyfinEncoding({ vendor: "nvidia" });
    expect(output).toContain("<HardwareAccelerationType>nvenc</HardwareAccelerationType>");
  });

  test("no GPU has empty HardwareAccelerationType", () => {
    const output = renderJellyfinEncoding({ vendor: "none" });
    expect(output).toContain("<HardwareAccelerationType></HardwareAccelerationType>");
  });

  test("Intel GPU includes VaapiDevice", () => {
    const output = renderJellyfinEncoding({ vendor: "intel" });
    expect(output).toContain("<VaapiDevice>/dev/dri/renderD128</VaapiDevice>");
  });

  test("Nvidia GPU has no VaapiDevice", () => {
    const output = renderJellyfinEncoding({ vendor: "nvidia" });
    expect(output).not.toContain("VaapiDevice");
  });

  test("EnableHardwareEncoding is true", () => {
    const output = renderJellyfinEncoding({ vendor: "intel" });
    expect(output).toContain("<EnableHardwareEncoding>true</EnableHardwareEncoding>");
  });
});

describe("FIRST-RUN.md", () => {
  const services = getServicesByIds(["jellyfin", "sonarr", "jellyseerr"]);

  test("lists service URLs with host IP and port", () => {
    const output = renderFirstRun({ services, hostIp: "192.168.1.10", adminUsername: "admin" });
    expect(output).toContain("192.168.1.10:8096");
    expect(output).toContain("192.168.1.10:8989");
  });

  test("admin username is mentioned", () => {
    const output = renderFirstRun({ services, hostIp: "192.168.1.10", adminUsername: "admin" });
    expect(output).toContain("admin");
  });

  test("mentions Jellyseerr manual step", () => {
    const output = renderFirstRun({ services, hostIp: "192.168.1.10", adminUsername: "admin" });
    expect(output).toContain("Jellyseerr");
  });
});

describe("dnsmasq.conf", () => {
  test("contains the address directive with tld and host IP", () => {
    const output = renderDnsmasqConf({ tld: "arr", hostIp: "192.168.1.10" });
    expect(output).toContain("address=/arr/192.168.1.10");
  });

  test("different TLD is rendered correctly", () => {
    const output = renderDnsmasqConf({ tld: "local", hostIp: "10.0.0.1" });
    expect(output).toContain("address=/local/10.0.0.1");
  });
});
