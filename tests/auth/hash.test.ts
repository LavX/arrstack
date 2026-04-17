import { describe, expect, test } from "bun:test";
import { bcryptHash, bcryptVerify, qbitPbkdf2Hash } from "../../src/auth/hash";

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
