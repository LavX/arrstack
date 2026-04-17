import { describe, expect, test } from "bun:test";
import { generateApiKey, generatePassword } from "../../src/lib/random";

describe("generateApiKey", () => {
  test("generateApiKey returns 32-char hex", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[a-f0-9]+$/);
  });
});

describe("generatePassword", () => {
  test("generatePassword has 4 dash-separated segments", () => {
    const pass = generatePassword();
    const parts = pass.split("-");
    expect(parts).toHaveLength(4);
    expect(parts.every(p => p.length === 4)).toBe(true);
  });
});

describe("uniqueness", () => {
  test("each call is unique", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
    expect(generatePassword()).not.toBe(generatePassword());
  });
});
