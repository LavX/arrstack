import { exec } from "../lib/exec.js";

export async function runRecyclarrSync(installDir: string): Promise<void> {
  const result = await exec(
    [
      "docker", "compose", "-f", `${installDir}/docker-compose.yml`,
      "run", "--rm", "recyclarr", "sync",
    ],
    { timeoutMs: 300_000 }
  );

  if (!result.ok) {
    const snippet = result.stderr.slice(-500);
    throw new Error(`recyclarr sync failed: ${snippet}`);
  }
}
