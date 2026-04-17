import { execSync_ } from "../lib/exec.js";

export function resolveGroupGid(name: string): number | null {
  try {
    const output = execSync_(["getent", "group", name]);
    if (!output) return null;
    // Format: name:password:gid:members
    const parts = output.split(":");
    if (parts.length < 3) return null;
    const gid = parseInt(parts[2], 10);
    return isNaN(gid) ? null : gid;
  } catch {
    return null;
  }
}

export function resolveRenderVideoGids(): { renderGid: number | null; videoGid: number | null } {
  let renderGid = resolveGroupGid("render");

  // Fallback: stat the render device
  if (renderGid === null) {
    try {
      const output = execSync_(["stat", "-c", "%g", "/dev/dri/renderD128"]);
      if (output) {
        const gid = parseInt(output.trim(), 10);
        renderGid = isNaN(gid) ? null : gid;
      }
    } catch {
      renderGid = null;
    }
  }

  const videoGid = resolveGroupGid("video");

  return { renderGid, videoGid };
}
