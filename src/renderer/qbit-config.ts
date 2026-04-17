import { renderFile } from "./engine.js";

export interface QbitConfigOptions {
  username: string;
  pbkdf2Hash: string;
}

export function renderQbitConfig(opts: QbitConfigOptions): string {
  return renderFile("qbittorrent.conf.hbs", { ...opts });
}
