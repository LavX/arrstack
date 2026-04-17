import { join } from "node:path";
import { readState } from "../state/store.js";
import { runPreflight, type CheckResult } from "../platform/preflight.js";
import { exec } from "../lib/exec.js";
import { getServicesByIds } from "../catalog/index.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function pass(label: string, msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${label}: ${msg}`);
}

function fail(label: string, msg: string, hint?: string) {
  console.log(`  ${RED}✗${RESET} ${label}: ${msg}`);
  if (hint) {
    console.log(`    ${YELLOW}→ ${hint}${RESET}`);
  }
}

function section(title: string) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

interface ContainerStatus {
  Service: string;
  State: string;
  Health?: string;
}

async function getContainerStatuses(composeFile: string): Promise<ContainerStatus[]> {
  const result = await exec(`docker compose -f "${composeFile}" ps --format json`, {
    timeoutMs: 15_000,
  });
  if (!result.ok) return [];

  // docker compose ps --format json emits one JSON object per line
  const lines = result.stdout.split("\n").filter((l) => l.trim().startsWith("{"));
  const statuses: ContainerStatus[] = [];
  for (const line of lines) {
    try {
      statuses.push(JSON.parse(line) as ContainerStatus);
    } catch {
      // skip malformed lines
    }
  }
  return statuses;
}

export async function runDoctor(installDir: string): Promise<void> {
  const state = readState(installDir);
  if (!state) {
    throw new Error(`No state.json found in ${installDir}. Run 'arrstack install' first.`);
  }

  let allOk = true;

  // --- Preflight checks ---
  section("System checks");
  const preflightResults = await runPreflight(state.storage_root);
  for (const check of preflightResults) {
    if (check.ok) {
      pass(check.name, check.message);
    } else {
      allOk = false;
      const hint = remediationHint(check);
      fail(check.name, check.message, hint);
    }
  }

  // --- Container status ---
  section("Container status");
  const composeFile = join(installDir, "docker-compose.yml");
  const containerStatuses = await getContainerStatuses(composeFile);

  const services = getServicesByIds(state.services_enabled);

  for (const svc of services) {
    const cs = containerStatuses.find(
      (c) => c.Service === svc.id || c.Service.endsWith(`-${svc.id}`)
    );
    if (!cs) {
      allOk = false;
      fail(svc.name, "container not found", `Run: docker compose -f ${composeFile} up -d ${svc.id}`);
      continue;
    }

    const running = cs.State === "running";
    const healthLabel = cs.Health ? ` (health: ${cs.Health})` : "";
    if (running) {
      pass(svc.name, `running${healthLabel}`);
    } else {
      allOk = false;
      fail(
        svc.name,
        `state: ${cs.State}${healthLabel}`,
        `Run: docker compose -f ${composeFile} logs ${svc.id}`
      );
    }
  }

  // --- HTTP health endpoints ---
  const httpServices = services.filter((s) => s.health?.type === "http");
  if (httpServices.length > 0) {
    section("HTTP health checks");
    await Promise.all(
      httpServices.map(async (svc) => {
        const health = svc.health!;
        const url = `http://localhost:${health.port}${health.path ?? "/"}`;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          // Many arr apps return 4xx before auth, but responding means the
          // process is up. We treat any response (including 4xx) as healthy.
          const statusOk = res.ok || res.status < 500;
          if (statusOk) {
            pass(svc.name, `${url} → ${res.status}`);
          } else {
            allOk = false;
            fail(svc.name, `${url} → ${res.status}`, `Check logs: arrstack logs ${svc.id}`);
          }
        } catch (err: any) {
          allOk = false;
          fail(svc.name, `${url} unreachable: ${err.message}`, `Check logs: arrstack logs ${svc.id}`);
        }
      })
    );
  }

  console.log("");
  if (allOk) {
    console.log(`${GREEN}All checks passed.${RESET}`);
  } else {
    console.log(`${RED}Some checks failed. Review the items above.${RESET}`);
    process.exitCode = 1;
  }
}

function remediationHint(check: CheckResult): string | undefined {
  const name = check.name.toLowerCase();
  if (name.includes("docker installed")) {
    return "Install Docker: https://docs.docker.com/engine/install/";
  }
  if (name.includes("docker running")) {
    return "Start Docker: sudo systemctl start docker";
  }
  if (name.includes("compose")) {
    return "Install Docker Compose v2: https://docs.docker.com/compose/install/";
  }
  if (name.includes("disk space")) {
    return "Free up disk space or point storage_root to a larger volume.";
  }
  if (name.includes("port")) {
    const match = check.name.match(/\d+/);
    if (match) {
      return `Find the process using port ${match[0]}: sudo ss -tlnp | grep :${match[0]}`;
    }
  }
  return undefined;
}
