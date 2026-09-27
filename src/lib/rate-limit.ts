import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { BetterAuthOptions } from "better-auth";
import { db, type DbExecutor } from "@/db";
import { rateLimits } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Fixed-window rate limits. With DATABASE_URL set, counters live in Postgres so
 * every serverless instance shares them; the embedded PGlite dev database is
 * single-process, so memory is enough there. Keys are hashed: no raw IPs or
 * phone numbers are stored.
 */
export type Decision = { allowed: boolean; retryAfter: number };
const WINDOW = 15 * 60_000;
const MEMORY_MAX = 10_000;
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

const buckets = new Map<string, { count: number; expires: number }>();
export function consumeMemory(key: string, limit: number, windowMs = WINDOW, now = Date.now()): Decision {
  const id = hash(key);
  let bucket = buckets.get(id);
  if (bucket && bucket.expires <= now) {
    buckets.delete(id);
    bucket = undefined;
  }
  if (!bucket) {
    if (buckets.size >= MEMORY_MAX) {
      for (const [k, v] of buckets) if (v.expires <= now) buckets.delete(k);
      // Still full: drop the oldest window rather than refusing everyone new.
      if (buckets.size >= MEMORY_MAX) buckets.delete(buckets.keys().next().value!);
    }
    buckets.set(id, { count: 1, expires: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  const retryAfter = Math.ceil((bucket.expires - now) / 1000);
  if (bucket.count >= limit) return { allowed: false, retryAfter };
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function consumeDb(
  key: string,
  limit: number,
  windowMs = WINDOW,
  now = Date.now(),
  executor: DbExecutor = db,
): Promise<Decision> {
  const at = new Date(now);
  const atSql = sql`${at.toISOString()}::timestamptz`;
  const expires = new Date(now + windowMs);
  // One atomic statement: start a fresh window if the old one ended, else count up.
  const [row] = await executor
    .insert(rateLimits)
    .values({ key: hash(key), count: 1, expiresAt: expires })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.expiresAt} <= ${atSql} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${atSql} THEN excluded.expires_at ELSE ${rateLimits.expiresAt} END`,
      },
    })
    .returning({ count: rateLimits.count, expiresAt: rateLimits.expiresAt });
  // Occasional cleanup keeps the table small without a cron job.
  if (Math.random() < 0.01)
    await executor.delete(rateLimits).where(lt(rateLimits.expiresAt, at)).catch(() => {});
  return row.count <= limit
    ? { allowed: true, retryAfter: 0 }
    : { allowed: false, retryAfter: Math.max(1, Math.ceil((row.expiresAt.getTime() - now) / 1000)) };
}

async function consume(key: string, limit: number, windowMs: number): Promise<Decision> {
  if (!env.DATABASE_URL) return consumeMemory(key, limit, windowMs);
  try {
    return await consumeDb(key, limit, windowMs);
  } catch {
    // A database hiccup must not lock shoppers out; fall back to this instance's counters.
    return consumeMemory(key, limit, windowMs);
  }
}

/** Shared limit for mutations (checkout, tracking, reviews, uploads). */
export async function takeRateLimit(scope: string, identity: string, limit: number, windowMs = WINDOW) {
  return (await consume(`${scope}:${identity}`, limit, windowMs)).allowed;
}

/** Per-instance limit for high-frequency reads where a DB write per request isn't worth it. */
export function takeMemoryRateLimit(scope: string, identity: string, limit: number, windowMs = WINDOW) {
  return consumeMemory(`${scope}:${identity}`, limit, windowMs).allowed;
}

/** Better Auth's sign-in limits use the same store, so they hold across instances too. */
export const authRateLimitStorage: NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]> = {
  async consume(key, rule) {
    const decision = await consume(`auth:${key}`, rule.max, rule.window * 1000);
    return { allowed: decision.allowed, retryAfter: decision.allowed ? null : decision.retryAfter };
  },
};

/**
 * The client address for rate limiting. Vercel sets a single x-forwarded-for
 * value; a self-hosted reverse proxy (Caddy, nginx) appends the peer it saw, so
 * the rightmost entry is the one a client cannot forge. Without any proxy in
 * front, headers are client-controlled; phone-keyed limits still apply.
 */
export function clientIp(headers: Headers) {
  const hops = (headers.get("x-forwarded-for") ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
  return (hops.at(-1) ?? headers.get("x-real-ip") ?? "local").slice(0, 100);
}
