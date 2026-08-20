import type { NextRequest } from 'next/server';

/**
 * S5/S3 — Rate limiting em memória (janela deslizante) por chave (e-mail/IP).
 * Adequado para instância única; em multi-instância, substituir por Redis.
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

// Limpa periodicamente entradas antigas (evita crescimento sem fim).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();
setInterval(() => {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < SWEEP_INTERVAL_MS);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref?.();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Permite no máximo `limit` requisições por chave em `windowMs`.
 * A chave deve ser estável e de baixo cardinalidade (ex.: e-mail, IP).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }
  bucket.hits.push(now);
  return { allowed: true };
}

/** Chave estável baseada no IP cliente (X-Forwarded-For na presença de proxy). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export function tooManyRequestsResponse(
  retryAfterSeconds: number
): Response {
  return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente novamente mais tarde.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds)
    }
  });
}