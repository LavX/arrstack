import { Command } from "commander";
import { VERSION } from "./version.js";

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
  .option("--install-dir <path>", "installation directory", "/opt/arrstack")
  .action((_opts) => {
    console.log("not yet implemented");
  });

program
  .command("doctor")
  .description("Check system requirements and diagnose issues")
  .action(() => {
    console.log("not yet implemented");
  });

program
  .command("update")
  .description("Update the arr media stack to the latest version")
  .action(() => {
    console.log("not yet implemented");
  });

program
  .command("show-password")
  .description("Show service passwords")
  .action(() => {
    console.log("not yet implemented");
  });

program
  .command("uninstall")
  .description("Uninstall the arr media stack")
  .action(() => {
    console.log("not yet implemented");
  });

program
  .command("logs <service>")
  .description("Show logs for a service")
  .action((_service) => {
    console.log("not yet implemented");
  });

program.parse(process.argv);
