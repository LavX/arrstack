import { test, expect } from "bun:test";
import { PUBLIC_INDEXERS, addProwlarrIndexers } from "../../src/wiring/prowlarr-indexers.js";
import { registerProwlarrApps } from "../../src/wiring/prowlarr-apps.js";

test("PUBLIC_INDEXERS has 8 entries with required fields", () => {
  expect(PUBLIC_INDEXERS).toHaveLength(8);
  for (const indexer of PUBLIC_INDEXERS) {
    expect(typeof indexer.name).toBe("string");
    expect(indexer.name.length).toBeGreaterThan(0);
    expect(typeof indexer.implementation).toBe("string");
    expect(typeof indexer.configContract).toBe("string");
    expect(Array.isArray(indexer.fields)).toBe(true);
    expect(indexer.fields.length).toBeGreaterThan(0);
  }
});

test("each PUBLIC_INDEXER uses Cardigann implementation with a definitionFile field", () => {
  for (const indexer of PUBLIC_INDEXERS) {
    expect(indexer.implementation).toBe("Cardigann");
    expect(indexer.configContract).toBe("CardigannSettings");
    const defField = indexer.fields.find((f) => f.name === "definitionFile");
    expect(defField).toBeDefined();
    expect(typeof defField?.value).toBe("string");
  }
});

test("addProwlarrIndexers is exported as async function", () => {
  expect(typeof addProwlarrIndexers).toBe("function");
  // Verify it returns a Promise (i.e. it's async) by checking the constructor name
  const result = addProwlarrIndexers("dummy-key", undefined, "http://localhost:9696");
  expect(result).toBeInstanceOf(Promise);
  // Avoid unhandled rejection from the dummy call
  result.catch(() => {});
});

test("registerProwlarrApps is exported as async function", () => {
  expect(typeof registerProwlarrApps).toBe("function");
  const result = registerProwlarrApps("pk", "sk", "rk", "http://localhost:9696");
  expect(result).toBeInstanceOf(Promise);
  result.catch(() => {});
});
