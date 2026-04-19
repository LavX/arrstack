import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "bun";
import { readState } from "../state/store.js";
import { getServicesByIds } from "../catalog/index.js";
import { getHostIp } from "./install.js";
import type { State } from "../state/schema.js";

// Managed block markers. Anything between these lines in /etc/hosts is owned
// by arrstack and replaced on each run. We never touch lines outside the block
// so user-authored entries survive.
const BEGIN = "# arrstack-begin";
const END = "# arrstack-end";
const HOSTS_PATH = "/etc/hosts";

export function stripArrstackBlock(contents: string): string {
  const lines = contents.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const ln of lines) {
    const trimmed = ln.trim();
    if (trimmed === BEGIN) {
      skipping = true;
      continue;
    }
    if (trimmed === END) {
      skipping = false;
      continue;
    }
    if (!skipping) out.push(ln);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.length === 0 ? "" : out.join("\n") + "\n";
}

export function buildArrstackBlock(hostIp: string, names: string[]): string {
  // One line per /etc/hosts entry is most portable; glibc NSS handles
  // multiple names on a single line fine, but some minimal libc's don't.
  const body = names.map((n) => `${hostIp} ${n}`).join("\n");
  return `${BEGIN}\n${body}\n${END}\n`;
}

export function gatherArrstackNames(state: State): string[] {
  const names = new Set<string>();
  const mode = state.remote_access.mode;
  const domain = state.remote_access.domain;
  const tld = state.local_dns.tld;
  const localOn = state.local_dns.enabled;

  const services = getServicesByIds(state.services_enabled).filter(
    (s) => s.adminPort !== undefined
  );

  if ((mode === "duckdns" || mode === "cloudflare") && domain) {
    // Apex + every service subdomain — lets users reach the public HTTPS URLs
    // from the LAN even without hairpin-NAT or public DNS hitting this box.
    names.add(domain);
    for (const s of services) names.add(`${s.id}.${domain}`);
  }

  if (localOn && tld) {
    for (const s of services) names.add(`${s.id}.${tld}`);
  }

  return [...names];
}

export async function runHosts(installDir: string): Promise<void> {
  const state = readState(installDir);
  if (!state) {
    throw new Error(
      `No arrstack install found at ${installDir}. Run 'arrstack install' first.`
    );
  }

  const hostIp = await getHostIp();
  if (!hostIp || hostIp === "localhost") {
    throw new Error(
      "Could not resolve this host's LAN IP via 'hostname -I'. Aborting."
    );
  }

  const names = gatherArrstackNames(state);
  if (names.length === 0) {
    console.log(
      "No hostnames to map. Remote access is off and local DNS is disabled, so /etc/hosts doesn't need arrstack entries."
    );
    return;
  }

  const current = readFileSync(HOSTS_PATH, "utf-8");
  const stripped = stripArrstackBlock(current);
  const block = buildArrstackBlock(hostIp, names);
  // Separate existing content from our block with a blank line when the
  // existing file doesn't already end with one.
  const sep = stripped.length === 0 || stripped.endsWith("\n\n") ? "" : "\n";
  const next = stripped + sep + block;

  console.log(`Will map ${names.length} hostnames -> ${hostIp} in ${HOSTS_PATH}:`);
  for (const n of names) console.log(`  ${hostIp}  ${n}`);
  console.log();

  // Write the new file to a temp path we own, then let sudo install it.
  // Using `install` preserves mode 0644 and performs an atomic rename.
  const tmpFile = `/tmp/arrstack-hosts-${process.pid}`;
  writeFileSync(tmpFile, next, { mode: 0o644 });

  try {
    const needsSudo =
      typeof process.getuid === "function" ? process.getuid() !== 0 : true;
    const argv = needsSudo
      ? ["sudo", "install", "-m", "0644", tmpFile, HOSTS_PATH]
      : ["install", "-m", "0644", tmpFile, HOSTS_PATH];

    if (needsSudo) {
      console.log("Updating /etc/hosts (sudo password may be required)...");
    }

    const proc = spawn(argv, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    const code = await proc.exited;
    if (code !== 0) {
      throw new Error(`'${argv[0]}' exited with code ${code}`);
    }
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // tmpfs; not critical if it lingers
    }
  }

  console.log();
  console.log(`Updated ${HOSTS_PATH}. Run 'arrstack hosts --revert' to remove.`);
}

export async function revertHosts(): Promise<void> {
  const current = readFileSync(HOSTS_PATH, "utf-8");
  const stripped = stripArrstackBlock(current);
  if (stripped === current) {
    console.log("No arrstack block found in /etc/hosts — nothing to revert.");
    return;
  }

  const tmpFile = `/tmp/arrstack-hosts-${process.pid}`;
  writeFileSync(tmpFile, stripped, { mode: 0o644 });

  try {
    const needsSudo =
      typeof process.getuid === "function" ? process.getuid() !== 0 : true;
    const argv = needsSudo
      ? ["sudo", "install", "-m", "0644", tmpFile, HOSTS_PATH]
      : ["install", "-m", "0644", tmpFile, HOSTS_PATH];

    if (needsSudo) {
      console.log("Removing arrstack block from /etc/hosts (sudo may be required)...");
    }

    const proc = spawn(argv, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    const code = await proc.exited;
    if (code !== 0) {
      throw new Error(`'${argv[0]}' exited with code ${code}`);
    }
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  }

  console.log("Reverted.");
}
