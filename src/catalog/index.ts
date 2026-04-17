import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { CatalogSchema, type Service } from "./schema.js";

let cachedServices: Service[] | null = null;

function parseCatalog(): Service[] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const yamlPath = join(__dirname, "services.yaml");
  const raw = readFileSync(yamlPath, "utf-8");
  const data = parse(raw);
  const catalog = CatalogSchema.parse(data);
  return catalog.services;
}

export function loadCatalog(): Service[] {
  if (cachedServices === null) {
    cachedServices = parseCatalog();
  }
  return cachedServices;
}

export function getService(id: string): Service | undefined {
  return loadCatalog().find((s) => s.id === id);
}

export function getDefaultServices(): Service[] {
  return loadCatalog().filter((s) => s.default);
}

export function getServicesByIds(ids: string[]): Service[] {
  const catalog = loadCatalog();
  return ids.flatMap((id) => {
    const svc = catalog.find((s) => s.id === id);
    return svc ? [svc] : [];
  });
}
