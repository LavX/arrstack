import { renderFile } from "./engine.js";

export type GpuVendor = "intel" | "amd" | "nvidia" | "none";

export interface JellyfinEncodingOptions {
  vendor: GpuVendor;
  deviceName?: string;
}

function hwTypeForVendor(vendor: GpuVendor): string {
  if (vendor === "intel" || vendor === "amd") return "vaapi";
  if (vendor === "nvidia") return "nvenc";
  return "";
}

function vaapiDeviceForVendor(vendor: GpuVendor, deviceName?: string): string {
  if (vendor !== "intel" && vendor !== "amd") return "";
  return deviceName ?? "/dev/dri/renderD128";
}

export function renderJellyfinEncoding(opts: JellyfinEncodingOptions): string {
  const hwType = hwTypeForVendor(opts.vendor);
  const vaapiDevice = vaapiDeviceForVendor(opts.vendor, opts.deviceName);
  return renderFile("encoding.xml.hbs", { hwType, vaapiDevice });
}
