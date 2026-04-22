// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Tiny in-memory token-bucket rate limiter for Vercel serverless functions.
//
// Per-instance only — distributed protection would require Upstash/KV, but
// in-memory already caps per-instance fan-out, which is what actually burns
// the Riot dev-key budget on a single hot instance.

const buckets = new Map();

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) return real;
  return req.socket?.remoteAddress ?? 'unknown';
}

function maybeSweep(now) {
  if (Math.random() > 0.01) return;
  for (const [key, entry] of buckets) {
    if (now - entry.lastRefill > 60 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(req, { bucket, capacity, refillSeconds }) {
  const ip = clientIp(req);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const refillPerMs = 1 / (refillSeconds * 1000);

  let entry = buckets.get(key);
  if (!entry) {
    entry = { tokens: capacity, lastRefill: now };
    buckets.set(key, entry);
  } else {
    const elapsed = now - entry.lastRefill;
    entry.tokens = Math.min(capacity, entry.tokens + elapsed * refillPerMs);
    entry.lastRefill = now;
  }

  if (entry.tokens < 1) {
    const tokensShort = 1 - entry.tokens;
    const retryAfter = tokensShort / refillPerMs / 1000;
    maybeSweep(now);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  entry.tokens -= 1;
  maybeSweep(now);
  return { allowed: true, retryAfter: 0, remaining: Math.floor(entry.tokens) };
}
