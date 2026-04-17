export interface OsRelease {
  id: string;
  idLike: string[];
  versionId: string;
  name: string;
}

export function parseOsRelease(content: string): OsRelease {
  const fields: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).toLowerCase();
    let value = trimmed.slice(eq + 1);

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    fields[key] = value;
  }

  return {
    id: fields["id"] ?? "",
    idLike: fields["id_like"] ? fields["id_like"].split(/\s+/).filter(Boolean) : [],
    versionId: fields["version_id"] ?? "",
    name: fields["name"] ?? "",
  };
}

// Returns 1, 2, 3 for supported tiers or -1 for unsupported
export function getDistroTier(id: string, versionId: string): 1 | 2 | 3 | -1 {
  const lId = id.toLowerCase();

  // Unsupported
  if (lId === "alpine") return -1;

  const ver = parseFloat(versionId);

  if (lId === "ubuntu") {
    if (!isNaN(ver) && ver >= 24.04) return 1;
    if (!isNaN(ver) && ver >= 22.04) return 2;
    return 3;
  }

  if (lId === "debian") {
    if (!isNaN(ver) && ver >= 13) return 1;
    if (!isNaN(ver) && ver >= 12) return 2;
    return 3;
  }

  if (lId === "fedora") {
    if (!isNaN(ver) && ver >= 43) return 1;
    return 3;
  }

  if (lId === "rhel" || lId === "rocky" || lId === "almalinux") {
    if (!isNaN(ver) && ver >= 9) return 2;
    return 3;
  }

  return 3;
}
