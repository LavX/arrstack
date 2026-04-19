/** @jsxImportSource react */
import { Command } from "commander";
import { VERSION } from "./version.js";
import { render } from "ink";
import React from "react";
import { App } from "./ui/App.js";
import { readState } from "./state/store.js";
import { runDoctor } from "./usecase/doctor.js";
import { runUpdate } from "./usecase/update.js";
import { showPassword } from "./usecase/show-password.js";
import { runUninstall } from "./usecase/uninstall.js";
import { tailLogs } from "./usecase/logs.js";
import { purgeInstallDir } from "./usecase/cleanup.js";
import { runHosts, revertHosts } from "./usecase/hosts.js";
import { exec } from "./lib/exec.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

const program = new Command();

program
  .name("arrstack")
  .description("Self-hosted arr media stack installer")
  .version(VERSION)
  .option("--verbose", "enable verbose output")
  .option("--non-interactive", "disable interactive prompts");

program
  .command("install")
  .description("Install the arr media stack")
  .option("--fresh", "perform a fresh installation")
  .option("--resume", "resume a previously interrupted installation")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .action(async (opts) => {
    const installDir = opts.installDir ?? `${process.env.HOME}/arrstack`;
    if (opts.fresh) {
      const composeFile = join(installDir, "docker-compose.yml");
      if (existsSync(composeFile)) {
        console.log("Stopping and removing existing containers...");
        const down = await exec(
          `docker compose -f "${composeFile}" down --remove-orphans`,
          { timeoutMs: 120_000 }
        );
        if (!down.ok) {
          console.warn(`docker compose down returned an error: ${down.stderr}`);
        }
      }
      const removed = await purgeInstallDir(installDir);
      for (const path of removed) {
        console.log(`Removed: ${path}`);
      }
    }
    const existing = opts.fresh ? null : readState(installDir);
    const { waitUntilExit } = render(React.createElement(App, { existingState: existing }));
    await waitUntilExit();
  });

program
  .command("doctor")
  .description("Check system requirements and diagnose issues")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .action(async (opts) => {
    await runDoctor(opts.installDir).catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  });

program
  .command("update")
  .description("Update the arr media stack to the latest version")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .action(async (opts) => {
    await runUpdate(opts.installDir).catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  });

program
  .command("show-password")
  .description("Show service passwords")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .action(async (opts) => {
    await showPassword(opts.installDir).catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  });

program
  .command("uninstall")
  .description("Uninstall the arr media stack")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .option("--purge", "also remove config files (media data is always preserved)")
  .action(async (opts) => {
    await runUninstall(opts.installDir, opts.purge ?? false).catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  });

program
  .command("hosts")
  .description(
    "Map arrstack hostnames to this host's LAN IP in /etc/hosts (uses sudo). Lets LAN clients reach https://{svc}.{domain} without hairpin-NAT."
  )
  .option("--revert", "remove the arrstack block from /etc/hosts instead of writing it")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .action(async (opts) => {
    const action = opts.revert ? revertHosts() : runHosts(opts.installDir);
    await action.catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  });

program
  .command("logs <service>")
  .description("Show logs for a service")
  .option("--install-dir <path>", "installation directory", `${process.env.HOME}/arrstack`)
  .action(async (service, opts) => {
    await tailLogs(opts.installDir, service).catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  });

// If no subcommand provided (just `arrstack`), launch the TUI
program.action(async () => {
  const installDir = `${process.env.HOME}/arrstack`;
  const existing = readState(installDir);
  const { waitUntilExit } = render(React.createElement(App, { existingState: existing }));
  await waitUntilExit();
});

program.parse(process.argv);
