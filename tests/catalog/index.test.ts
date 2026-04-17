import { test, expect } from "bun:test";
import {
  loadCatalog,
  getService,
  getDefaultServices,
  getServicesByIds,
} from "../../src/catalog/index.js";

test("loads all services from yaml", () => {
  const services = loadCatalog();
  expect(services.length).toBeGreaterThanOrEqual(10);
});

test("getService returns sonarr with correct image", () => {
  const sonarr = getService("sonarr");
  expect(sonarr).toBeDefined();
  expect(sonarr!.image).toBe("lscr.io/linuxserver/sonarr");
  expect(sonarr!.category).toBe("arr");
});

test("getDefaultServices returns only default-true", () => {
  const defaults = getDefaultServices();
  expect(defaults.length).toBeGreaterThan(0);
  for (const svc of defaults) {
    expect(svc.default).toBe(true);
  }
  // tdarr and gluetun are not defaults
  const ids = defaults.map((s) => s.id);
  expect(ids).not.toContain("tdarr");
  expect(ids).not.toContain("gluetun");
});

test("getServicesByIds returns matching subset", () => {
  const subset = getServicesByIds(["sonarr", "radarr"]);
  expect(subset).toHaveLength(2);
  const ids = subset.map((s) => s.id);
  expect(ids).toContain("sonarr");
  expect(ids).toContain("radarr");
});

test("getServicesByIds silently drops unknown ids", () => {
  const subset = getServicesByIds(["sonarr", "nonexistent"]);
  expect(subset).toHaveLength(1);
  expect(subset[0].id).toBe("sonarr");
});

test("loadCatalog returns same reference on second call", () => {
  const a = loadCatalog();
  const b = loadCatalog();
  expect(a).toBe(b);
});
