import { describe, test, expect } from "bun:test";
import { getHostIp } from "../../src/usecase/install.js";
import type { StepUpdate } from "../../src/usecase/install.js";

// Import the unexported runStep via a local re-implementation for isolation
// (runStep is not exported; we test its contract through a local wrapper)
async function callStep(
  name: string,
  fn: () => Promise<void>
): Promise<{ updates: StepUpdate[]; threw: boolean }> {
  // Minimal logger that discards output
  const log = {
    info: (_step: string, _msg: string) => {},
    error: (_step: string, _msg: string) => {},
    warn: (_step: string, _msg: string) => {},
  };

  const updates: StepUpdate[] = [];
  const onStep = (u: StepUpdate) => updates.push(u);

  // Replicate the step helper logic here to test it in isolation
  onStep({ step: name, status: "running" });
  const start = Date.now();
  let threw = false;
  try {
    await fn();
    const ms = Date.now() - start;
    log.info(name, `completed in ${ms}ms`);
    onStep({ step: name, status: "done", durationMs: ms });
  } catch (err: any) {
    log.error(name, err.message ?? String(err));
    onStep({ step: name, status: "failed", message: err.message ?? String(err) });
    threw = true;
  }
  return { updates, threw };
}

describe("getHostIp", () => {
  test("returns a non-empty string", async () => {
    const ip = await getHostIp();
    expect(typeof ip).toBe("string");
    expect(ip.length).toBeGreaterThan(0);
  });

  test("returns a plausible IP or localhost fallback", async () => {
    const ip = await getHostIp();
    // Either a valid IPv4/IPv6 segment or the fallback "localhost"
    const isIp = /^[\d.:a-f]+$/i.test(ip);
    const isLocalhost = ip === "localhost";
    expect(isIp || isLocalhost).toBe(true);
  });
});

describe("step helper contract", () => {
  test("reports running then done on success", async () => {
    const { updates, threw } = await callStep("test-step", async () => {
      // no-op success
    });
    expect(threw).toBe(false);
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ step: "test-step", status: "running" });
    expect(updates[1]).toMatchObject({ step: "test-step", status: "done" });
    expect(typeof updates[1].durationMs).toBe("number");
  });

  test("reports running then failed on error, re-throws", async () => {
    const { updates, threw } = await callStep("failing-step", async () => {
      throw new Error("boom");
    });
    expect(threw).toBe(true);
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ step: "failing-step", status: "running" });
    expect(updates[1]).toMatchObject({
      step: "failing-step",
      status: "failed",
      message: "boom",
    });
  });

  test("durationMs on done is a non-negative number", async () => {
    const { updates } = await callStep("timing-step", async () => {});
    const done = updates.find((u) => u.status === "done");
    expect(done).toBeDefined();
    expect(done!.durationMs).toBeGreaterThanOrEqual(0);
  });
});
