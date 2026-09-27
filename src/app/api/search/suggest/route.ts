import type { NextRequest } from "next/server";
import { searchSuggestions } from "@/lib/catalog/query";
import { clientIp, takeMemoryRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

/** Header autosuggest: GET /api/search/suggest?q=… → top 5 products + matching brands. Public, read-only. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length > 160) return Response.json({ error: "Query too long." }, { status: 400 });
  // Generous and per-instance: a shopper typing produces one request per pause, not per key.
  if (!takeMemoryRateLimit("suggest-ip", clientIp(request.headers), 900))
    return Response.json({ error: "Too many searches. Please wait a moment." }, { status: 429 });
  try {
    const data = await searchSuggestions(q);
    return Response.json(data, {
      headers: {
        // The public demo answers from each visitor's own sandbox: never let a CDN share it.
        "Cache-Control": env.DEMO_MODE ? "private, no-store" : "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
