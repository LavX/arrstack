import Handlebars from "handlebars";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-ignore: Bun text imports for compiled binary embedding
import tplCompose from "../../templates/compose.yml.hbs" with { type: "text" };
// @ts-ignore
import tplCaddyfile from "../../templates/Caddyfile.hbs" with { type: "text" };
// @ts-ignore
import tplBazarr from "../../templates/bazarr-config.yaml.hbs" with { type: "text" };
// @ts-ignore
import tplQbit from "../../templates/qbittorrent.conf.hbs" with { type: "text" };
// @ts-ignore
import tplServarr from "../../templates/servarr-config.xml.hbs" with { type: "text" };
// @ts-ignore
import tplRecyclarr from "../../templates/recyclarr.yml.hbs" with { type: "text" };
// @ts-ignore
import tplEncoding from "../../templates/encoding.xml.hbs" with { type: "text" };
// @ts-ignore
import tplFirstRun from "../../templates/FIRST-RUN.md.hbs" with { type: "text" };
// @ts-ignore
import tplDnsmasq from "../../templates/dnsmasq.conf.hbs" with { type: "text" };
// @ts-ignore
import tplCaddyDockerfile from "../../templates/caddy.Dockerfile" with { type: "text" };

const EMBEDDED_TEMPLATES: Record<string, string> = {
  "compose.yml.hbs": tplCompose,
  "Caddyfile.hbs": tplCaddyfile,
  "bazarr-config.yaml.hbs": tplBazarr,
  "qbittorrent.conf.hbs": tplQbit,
  "servarr-config.xml.hbs": tplServarr,
  "recyclarr.yml.hbs": tplRecyclarr,
  "encoding.xml.hbs": tplEncoding,
  "FIRST-RUN.md.hbs": tplFirstRun,
  "dnsmasq.conf.hbs": tplDnsmasq,
  "caddy.Dockerfile": tplCaddyDockerfile,
};

export function getTemplateSource(templateName: string): string {
  const source = EMBEDDED_TEMPLATES[templateName];
  if (source) return source;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(__dirname, "..", "..", "templates", templateName);
  return readFileSync(templatePath, "utf-8");
}

Handlebars.registerHelper("eq", function (a: unknown, b: unknown) {
  return a === b;
});

export function renderTemplate(source: string, context: Record<string, unknown>): string {
  const template = Handlebars.compile(source, { noEscape: true });
  return template(context);
}

export function renderFile(templateName: string, context: Record<string, unknown>): string {
  let source = EMBEDDED_TEMPLATES[templateName];
  if (!source) {
    // Fallback to filesystem for dev mode
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const projectRoot = join(__dirname, "..", "..");
    const templatePath = join(projectRoot, "templates", templateName);
    source = readFileSync(templatePath, "utf-8");
  }
  return renderTemplate(source, context);
}
