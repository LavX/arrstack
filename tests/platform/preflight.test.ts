import { test, expect, describe, afterEach } from "bun:test";
import { checkPortFree } from "../../src/platform/ports.js";

describe("checkPortFree", () => {
  const servers: ReturnType<typeof Bun.serve>[] = [];

  afterEach(() => {
    for (const server of servers) {
      server.stop(true);
    }
    servers.length = 0;
  });

  test("reports a bound port as in-use", async () => {
    // Bind on port 0 to get a random free port assigned by the OS
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("ok");
      },
    });
    servers.push(server);

    const boundPort = server.port;
    expect(boundPort).toBeGreaterThan(0);

    const free = await checkPortFree(boundPort);
    expect(free).toBe(false);
  });

  test("reports a high unused port as free", async () => {
    // Port 59999 is very unlikely to be in use in a CI environment
    const free = await checkPortFree(59999);
    expect(free).toBe(true);
  });
});
