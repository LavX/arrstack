// Small retry helper for wiring HTTP calls. Freshly-started *arr containers
// often reject the first few requests (connection refused, 500 while the DB
// migration runs). One transient failure should not abort the entire install.

export interface RetryOpts {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

function defaultShouldRetry(err: unknown): boolean {
  // Undici throws TypeError/AggregateError on connection refused / socket hang up.
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONN|socket hang up|fetch failed|network|UND_ERR/i.test(msg);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const attempts = opts.attempts ?? 6;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !shouldRetry(err)) throw err;
      const delay = Math.min(maxMs, baseMs * 2 ** i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Fetch-style helper that also retries on transient HTTP status codes
// (502/503/504 and, for the first few attempts, 500/401 — arr apps return those
// while migrations finish).
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOpts = {},
): Promise<Response> {
  const attempts = opts.attempts ?? 6;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      const transient =
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        // arr apps answer 500/401 while their SQLite migrations are running;
        // forgive those only in the first half of the retry budget.
        (i < Math.floor(attempts / 2) && (res.status === 500 || res.status === 401));

      if (!transient) return res;
      lastErr = new Error(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      lastErr = err;
      if (!defaultShouldRetry(err)) throw err;
    }
    if (i === attempts - 1) break;
    const delay = Math.min(maxMs, baseMs * 2 ** i);
    await new Promise((r) => setTimeout(r, delay));
  }
  throw lastErr;
}
