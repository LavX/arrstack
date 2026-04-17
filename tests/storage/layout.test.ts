import { describe, test, expect, beforeEach } from "bun:test";
import { createStorageLayout } from "../../src/storage/layout.js";
import { mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("storage layout", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "arrstack-data-")); });

  test("creates the full TRaSH directory tree", () => {
    createStorageLayout(root, 1000, 1000);
    expect(existsSync(join(root, "torrents/tv"))).toBe(true);
    expect(existsSync(join(root, "torrents/movies"))).toBe(true);
    expect(existsSync(join(root, "torrents/music"))).toBe(true);
    expect(existsSync(join(root, "torrents/books"))).toBe(true);
    expect(existsSync(join(root, "media/tv"))).toBe(true);
    expect(existsSync(join(root, "media/movies"))).toBe(true);
    expect(existsSync(join(root, "media/music"))).toBe(true);
  });

  test("is idempotent", () => {
    createStorageLayout(root, 1000, 1000);
    createStorageLayout(root, 1000, 1000);
    expect(existsSync(join(root, "torrents/tv"))).toBe(true);
  });

  test("creates tv/movies inside each extra path for add-a-drive flow", () => {
    const extra1 = mkdtempSync(join(tmpdir(), "arrstack-extra1-"));
    const extra2 = mkdtempSync(join(tmpdir(), "arrstack-extra2-"));
    createStorageLayout(root, 1000, 1000, [extra1, extra2]);
    expect(existsSync(join(extra1, "tv"))).toBe(true);
    expect(existsSync(join(extra1, "movies"))).toBe(true);
    expect(existsSync(join(extra2, "tv"))).toBe(true);
    expect(existsSync(join(extra2, "movies"))).toBe(true);
  });
});
