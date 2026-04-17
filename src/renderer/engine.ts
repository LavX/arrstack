import Handlebars from "handlebars";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

Handlebars.registerHelper("eq", function (a: unknown, b: unknown) {
  return a === b;
});

export function renderTemplate(source: string, context: Record<string, unknown>): string {
  const template = Handlebars.compile(source, { noEscape: true });
  return template(context);
}

export function renderFile(templateName: string, context: Record<string, unknown>): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..", "..");
  const templatePath = join(projectRoot, "templates", templateName);
  const source = readFileSync(templatePath, "utf-8");
  return renderTemplate(source, context);
}
