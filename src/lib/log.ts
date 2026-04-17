import { openSync, writeSync, closeSync } from "node:fs";

export interface Logger {
  info(step: string, msg: string): void;
  error(step: string, msg: string): void;
  warn(step: string, msg: string): void;
}

export function createLogger(filePath: string): Logger {
  // Open with 'w' flag to truncate/create fresh
  const fd = openSync(filePath, "w");

  function write(level: string, step: string, msg: string): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, step, msg }) + "\n";
    writeSync(fd, line);
  }

  return {
    info(step, msg) {
      write("info", step, msg);
    },
    error(step, msg) {
      write("error", step, msg);
      process.stderr.write(`[error] ${step}: ${msg}\n`);
    },
    warn(step, msg) {
      write("warn", step, msg);
    },
  };
}
