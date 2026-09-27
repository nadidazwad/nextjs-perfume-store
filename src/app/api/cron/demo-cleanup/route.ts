import { timingSafeEqual } from "node:crypto";
import { dropExpiredSandboxes } from "@/lib/demo/sandbox";
import { env } from "@/lib/env";

/**
 * Public demo backstop (DEMO_MODE): removes expired sandboxes, their demo users
 * and any leftovers. Starting a demo already does this lazily; Vercel Cron
 * calls this once a day (vercel.json) with `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!env.DEMO_MODE) return new Response("Not found", { status: 404 });
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ""}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (!env.CRON_SECRET || given.length !== expected.length || !timingSafeEqual(given, expected))
    return new Response("Unauthorized", { status: 401 });
  const removed = await dropExpiredSandboxes();
  return Response.json({ removed: removed.length }, { headers: { "Cache-Control": "private, no-store" } });
}
