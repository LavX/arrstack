import { test, expect, describe } from "bun:test";
import { parseOsRelease, getDistroTier } from "../../src/platform/distro.js";

const FEDORA_CONTENT = `NAME="Fedora Linux"
VERSION="43 (Workstation Edition)"
ID=fedora
VERSION_ID=43
PRETTY_NAME="Fedora Linux 43 (Workstation Edition)"
ANSI_COLOR="0;38;2;60;110;180"
LOGO=fedora-logo-icon
CPE_NAME="cpe:/o:fedoraproject:fedora:43"
HOME_URL="https://fedoraproject.org/"
DOCUMENTATION_URL="https://docs.fedoraproject.org/en-US/fedora/latest/"
SUPPORT_URL="https://ask.fedoraproject.org/"
BUG_REPORT_URL="https://bugzilla.redhat.com/"
REDHAT_BUGZILLA_PRODUCT="Fedora"
REDHAT_BUGZILLA_PRODUCT_VERSION=43
REDHAT_SUPPORT_PRODUCT="Fedora"
REDHAT_SUPPORT_PRODUCT_VERSION=43
SUPPORT_END=2025-05-13
`;

const UBUNTU_2404_CONTENT = `PRETTY_NAME="Ubuntu 24.04.1 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.1 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=noble
LOGO=ubuntu-logo
`;

const ALPINE_CONTENT = `NAME="Alpine Linux"
ID=alpine
VERSION_ID=3.19.0
PRETTY_NAME="Alpine Linux v3.19"
HOME_URL="https://alpinelinux.org/"
BUG_REPORT_URL="https://gitlab.alpinelinux.org/alpine/aports/-/issues"
`;

describe("parseOsRelease", () => {
  test("parses Fedora content correctly", () => {
    const info = parseOsRelease(FEDORA_CONTENT);
    expect(info.id).toBe("fedora");
    expect(info.versionId).toBe("43");
    expect(info.name).toBe("Fedora Linux");
    expect(info.idLike).toEqual([]);
  });

  test("parses Ubuntu content with quoted values", () => {
    const info = parseOsRelease(UBUNTU_2404_CONTENT);
    expect(info.id).toBe("ubuntu");
    expect(info.versionId).toBe("24.04");
    expect(info.name).toBe("Ubuntu");
    expect(info.idLike).toContain("debian");
  });

  test("parses Alpine content correctly", () => {
    const info = parseOsRelease(ALPINE_CONTENT);
    expect(info.id).toBe("alpine");
    expect(info.versionId).toBe("3.19.0");
  });

  test("handles mixed quoted and unquoted values", () => {
    const content = `ID=mylinux\nVERSION_ID="1.0"\nNAME='My Linux'\n`;
    const info = parseOsRelease(content);
    expect(info.id).toBe("mylinux");
    expect(info.versionId).toBe("1.0");
    expect(info.name).toBe("My Linux");
  });

  test("handles id_like with multiple values", () => {
    const content = `ID=linuxmint\nID_LIKE="ubuntu debian"\nVERSION_ID="21"\n`;
    const info = parseOsRelease(content);
    expect(info.idLike).toEqual(["ubuntu", "debian"]);
  });
});

describe("getDistroTier", () => {
  test("classifies Ubuntu 24.04 as tier 1", () => {
    expect(getDistroTier("ubuntu", "24.04")).toBe(1);
  });

  test("classifies Ubuntu 24.10 as tier 1", () => {
    expect(getDistroTier("ubuntu", "24.10")).toBe(1);
  });

  test("classifies Ubuntu 22.04 as tier 2", () => {
    expect(getDistroTier("ubuntu", "22.04")).toBe(2);
  });

  test("classifies Ubuntu 20.04 as tier 3", () => {
    expect(getDistroTier("ubuntu", "20.04")).toBe(3);
  });

  test("classifies Debian 13 as tier 1", () => {
    expect(getDistroTier("debian", "13")).toBe(1);
  });

  test("classifies Debian 12 as tier 2", () => {
    expect(getDistroTier("debian", "12")).toBe(2);
  });

  test("classifies Debian 11 as tier 3", () => {
    expect(getDistroTier("debian", "11")).toBe(3);
  });

  test("classifies Fedora 43 as tier 1", () => {
    expect(getDistroTier("fedora", "43")).toBe(1);
  });

  test("classifies Fedora 42 as tier 3", () => {
    expect(getDistroTier("fedora", "42")).toBe(3);
  });

  test("classifies RHEL 9 as tier 2", () => {
    expect(getDistroTier("rhel", "9")).toBe(2);
  });

  test("classifies Rocky 9.3 as tier 2", () => {
    expect(getDistroTier("rocky", "9.3")).toBe(2);
  });

  test("classifies AlmaLinux 9 as tier 2", () => {
    expect(getDistroTier("almalinux", "9")).toBe(2);
  });

  test("classifies Alpine as unsupported (-1)", () => {
    expect(getDistroTier("alpine", "3.19.0")).toBe(-1);
  });

  test("classifies unknown distro as tier 3", () => {
    expect(getDistroTier("archlinux", "")).toBe(3);
  });
});
