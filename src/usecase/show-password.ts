import { existsSync } from "node:fs";
import { join } from "node:path";

export async function showPassword(installDir: string): Promise<void> {
  const adminTxt = join(installDir, "admin.txt");
  if (!existsSync(adminTxt)) {
    console.log("No admin.txt found. Run 'arrstack install' first.");
    return;
  }
  const file = Bun.file(adminTxt);
  process.stdout.write(await file.text());
}
