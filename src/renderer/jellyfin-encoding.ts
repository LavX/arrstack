import { renderFile } from "./engine.js";

export type GpuVendor = "intel" | "amd" | "nvidia" | "none";

export interface JellyfinEncodingOptions {
  vendor: GpuVendor;
  // Optional override for the DRI render node (e.g. "/dev/dri/renderD129"
  // when the iGPU is secondary). Must be a /dev path, not the lspci name.
  devicePath?: string;
}

function hwTypeForVendor(vendor: GpuVendor): string {
  if (vendor === "intel" || vendor === "amd") return "vaapi";
  if (vendor === "nvidia") return "nvenc";
  return "";
}

function vaapiDeviceForVendor(vendor: GpuVendor, devicePath?: string): string {
  if (vendor !== "intel" && vendor !== "amd") return "";
  return devicePath ?? "/dev/dri/renderD128";
}

export function renderJellyfinEncoding(opts: JellyfinEncodingOptions): string {
  const hwType = hwTypeForVendor(opts.vendor);
  const vaapiDevice = vaapiDeviceForVendor(opts.vendor, opts.devicePath);
  return renderFile("encoding.xml.hbs", { hwType, vaapiDevice });
}
