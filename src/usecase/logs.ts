import { join } from "node:path";
import { spawn } from "child_process";

export async function tailLogs(installDir: string, service: string): Promise<void> {
  const composeFile = join(installDir, "docker-compose.yml");

  const child = spawn(
    "docker",
    ["compose", "-f", composeFile, "logs", "-f", service],
    { stdio: "inherit" }
  );

  await new Promise<void>((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`docker compose logs exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}
