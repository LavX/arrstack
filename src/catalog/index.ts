import { parse } from "yaml";
import { CatalogSchema, type Service } from "./schema.js";
// @ts-ignore: Bun text import
import servicesYaml from "./services.yaml" with { type: "text" };

let cachedServices: Service[] | null = null;

function parseCatalog(): Service[] {
  const data = parse(servicesYaml);
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
