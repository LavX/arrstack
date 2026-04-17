import { test, expect, describe } from "bun:test";
import { parseLspci } from "../../src/platform/gpu.js";
import { resolveGroupGid } from "../../src/platform/groups.js";

const LSPCI_SAMPLE = `
00:00.0 Host bridge [0600]: Intel Corporation 12th Gen Core Processor Host Bridge/DRAM Registers [8086:4660] (rev 02)
00:02.0 VGA compatible controller [0300]: Intel Corporation Alder Lake-P GT2 [Iris Xe Graphics] [8086:46a6] (rev 0c)
00:1f.0 ISA bridge [0601]: Intel Corporation Alder Lake PCH eSPI Controller [8086:5182] (rev 11)
01:00.0 VGA compatible controller [0300]: Advanced Micro Devices, Inc. [AMD/ATI] Navi 23 [Radeon RX 6650 XT] [1002:73ef] (rev c7)
02:00.0 3D controller [0302]: NVIDIA Corporation GA106M [GeForce RTX 3060 Mobile / Max-Q] [10de:2520] (rev a1)
03:00.0 Audio device [0403]: NVIDIA Corporation GA106 High Definition Audio Controller [10de:228e] (rev a1)
`.trim();

describe("parseLspci", () => {
  test("detects Intel GPU", () => {
    const gpus = parseLspci(LSPCI_SAMPLE);
    const intel = gpus.find((g) => g.vendor === "intel");
    expect(intel).toBeDefined();
    expect(intel!.pciId).toBe("8086:46a6");
    expect(intel!.name).toContain("Intel");
  });

  test("detects AMD GPU", () => {
    const gpus = parseLspci(LSPCI_SAMPLE);
    const amd = gpus.find((g) => g.vendor === "amd");
    expect(amd).toBeDefined();
    expect(amd!.pciId).toBe("1002:73ef");
    expect(amd!.name).toContain("AMD");
  });

  test("detects NVIDIA GPU", () => {
    const gpus = parseLspci(LSPCI_SAMPLE);
    const nvidia = gpus.find((g) => g.vendor === "nvidia");
    expect(nvidia).toBeDefined();
    expect(nvidia!.pciId).toBe("10de:2520");
    expect(nvidia!.name).toContain("NVIDIA");
  });

  test("does not include non-display-class devices", () => {
    const gpus = parseLspci(LSPCI_SAMPLE);
    // The NVIDIA audio device [0403] and Intel host bridge [0600] should be excluded
    for (const gpu of gpus) {
      expect(gpu.pciId).not.toBe("10de:228e");
      expect(gpu.pciId).not.toBe("8086:4660");
    }
  });

  test("returns empty array for empty input", () => {
    expect(parseLspci("")).toEqual([]);
  });

  test("returns empty array when no GPU lines present", () => {
    const noGpu = `00:1f.0 ISA bridge [0601]: Intel Corporation Something [8086:5182]`;
    expect(parseLspci(noGpu)).toEqual([]);
  });
});

describe("resolveGroupGid", () => {
  test("resolves root group to GID 0", () => {
    const gid = resolveGroupGid("root");
    expect(gid).toBe(0);
  });

  test("returns null for a non-existent group", () => {
    const gid = resolveGroupGid("this-group-definitely-does-not-exist-xyzzy");
    expect(gid).toBeNull();
  });
});
