import { describe, expect, test } from "bun:test";
import { renderTemplate } from "../../src/renderer/engine";

describe("renderTemplate", () => {
  test("interpolates a simple variable", () => {
    const result = renderTemplate("Hello {{name}}!", { name: "world" });
    expect(result).toBe("Hello world!");
  });

  test("renders each block over an array", () => {
    const result = renderTemplate(
      "{{#each items}}{{this}},{{/each}}",
      { items: ["a", "b", "c"] }
    );
    expect(result).toBe("a,b,c,");
  });

  test("eq helper works for truthy comparison", () => {
    const result = renderTemplate(
      "{{#if (eq mode \"none\")}}lan{{else}}remote{{/if}}",
      { mode: "none" }
    );
    expect(result).toBe("lan");
  });

  test("eq helper works for falsy comparison", () => {
    const result = renderTemplate(
      "{{#if (eq mode \"none\")}}lan{{else}}remote{{/if}}",
      { mode: "cloudflare" }
    );
    expect(result).toBe("remote");
  });
});
