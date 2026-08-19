/**
 * Process-local rate limits (PIN brute-force / abuse).
 * Multi-instance deploy'da her instance ayrı sayar; yine de deviceId'den
 * bağımsız IP+slug kilidi tek process'te spoof döngüsünü keser.
 */

type Bucket = {
  fails: number;
  firstFailAt: number;
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) {
    if (b.lockedUntil < now && now - b.firstFailAt > WINDOW_MS) {
      buckets.delete(k);
    }
  }
}

export function clientIpFromRequest(req: {
  headers: { get(name: string): string | null };
}): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

/** PIN denemesi için bucket anahtarı — deviceId kullanılmaz */
export function pinRateKey(slug: string, ip: string) {
  return `pin:${slug}:${ip}`;
}

export function checkPinRateLimit(key: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);
  if (!b) return { ok: true };
  if (b.lockedUntil > now) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000),
    };
  }
  if (now - b.firstFailAt > WINDOW_MS) {
    buckets.delete(key);
    return { ok: true };
  }
  return { ok: true };
}

export function recordPinFailure(key: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.firstFailAt > WINDOW_MS) {
    buckets.set(key, {
      fails: 1,
      firstFailAt: now,
      lockedUntil: 0,
    });
    return;
  }
  b.fails += 1;
  if (b.fails >= MAX_FAILS) {
    b.lockedUntil = now + LOCK_MS;
  }
}

export function clearPinFailures(key: string) {
  buckets.delete(key);
}
