import { existsSync } from "node:fs";
import { exec } from "../lib/exec.js";

export interface GpuInfo {
  vendor: "intel" | "amd" | "nvidia" | "unknown";
  name: string;
  pciId: string;
}

// Vendor ID to name mapping
const VENDOR_MAP: Record<string, GpuInfo["vendor"]> = {
  "8086": "intel",
  "1002": "amd",
  "10de": "nvidia",
};

// Matches lines like:
// 00:02.0 VGA compatible controller [0300]: Intel Corporation ... [8086:1234] (rev 0a)
// 01:00.0 3D controller [0302]: NVIDIA Corporation ... [10de:abcd] (rev a1)
const DISPLAY_CLASS_RE = /\[03[02][0-9a-f]\]/i;
const PCI_ID_RE = /\[([0-9a-f]{4}):([0-9a-f]{4})\]/gi;

export function parseLspci(output: string): GpuInfo[] {
  const gpus: GpuInfo[] = [];

  for (const line of output.split("\n")) {
    if (!DISPLAY_CLASS_RE.test(line)) continue;

    // Reset lastIndex since PCI_ID_RE is global
    PCI_ID_RE.lastIndex = 0;

    // Find all [xxxx:yyyy] pairs; the last one in a line is the device PCI ID
    let match: RegExpExecArray | null;
    let lastMatch: RegExpExecArray | null = null;
    while ((match = PCI_ID_RE.exec(line)) !== null) {
      lastMatch = match;
    }

    if (!lastMatch) continue;

    const vendorId = lastMatch[1].toLowerCase();
    const deviceId = lastMatch[2].toLowerCase();
    const pciId = `${vendorId}:${deviceId}`;
    const vendor = VENDOR_MAP[vendorId] ?? "unknown";

    // Extract device name: everything after the class label up to the PCI id bracket
    const nameMatch = line.match(/\]:?\s+(.+?)\s+\[[\da-f]{4}:[\da-f]{4}\]/i);
    const name = nameMatch ? nameMatch[1].trim() : line.trim();

    gpus.push({ vendor, name, pciId });
  }

  return gpus;
}

export async function detectGpus(): Promise<GpuInfo[]> {
  const result = await exec("lspci -nn", { timeoutMs: 10000 });
  if (!result.ok) return [];
  return parseLspci(result.stdout);
}

export function hasDriDevice(): boolean {
  return existsSync("/dev/dri/renderD128");
}

export async function hasNvidiaToolkit(): Promise<boolean> {
  const result = await exec("nvidia-ctk --version", { timeoutMs: 5000 });
  return result.ok;
}
