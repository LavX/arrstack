import { describe, expect, test } from "bun:test";
import { bcryptHash, bcryptVerify, qbitPbkdf2Hash, bazarrPbkdf2Hash } from "../../src/auth/hash";
import { pbkdf2Sync } from "crypto";

describe("bcrypt", () => {
  test("bcrypt roundtrip", async () => {
    const hash = await bcryptHash("testpass123");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await bcryptVerify("testpass123", hash)).toBe(true);
    expect(await bcryptVerify("wrong", hash)).toBe(false);
  });
});

describe("qbitPbkdf2Hash", () => {
  test("qbit PBKDF2 produces ByteArray format", () => {
    const hash = qbitPbkdf2Hash("testpass123");
    expect(hash).toMatch(/^@ByteArray\(/);
    expect(hash).toContain(":");
    expect(hash).toEndWith(")");
  });
});

describe("bazarrPbkdf2Hash", () => {
  test("emits pbkdf2:<salt_hex>:<hash_hex> with 32-byte SHA-256", () => {
    const hash = bazarrPbkdf2Hash("testpass123");
    const [prefix, saltHex, hashHex] = hash.split(":");
    expect(prefix).toBe("pbkdf2");
    expect(saltHex).toMatch(/^[0-9a-f]{32}$/); // 16 bytes
    expect(hashHex).toMatch(/^[0-9a-f]{64}$/); // 32 bytes
  });

  test("verifies with Bazarr+'s exact algorithm (SHA-256, 600k iters)", () => {
    const hash = bazarrPbkdf2Hash("testpass123");
    const [, saltHex, hashHex] = hash.split(":");
    const salt = Buffer.from(saltHex, "hex");
    const expected = pbkdf2Sync("testpass123", salt, 600_000, 32, "sha256").toString("hex");
    expect(hashHex).toBe(expected);
  });
});
