import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { getSessionCookie } from "better-auth/cookies";
import { publicDb } from "@/db";
import { demoSandboxes } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { setSandboxCookie } from "@/lib/demo/session";
import { authSecret, env } from "@/lib/env";

/**
 * A demo visitor signed in with their generated credentials (another device, or
 * after signing out) has a session but no sandbox cookie. Re-issue it for their
 * own live sandbox, bound to this session, and continue to the admin.
 */
export async function GET(request: NextRequest) {
  if (!env.DEMO_MODE) return new Response("Not found", { status: 404 });
  const to = (path: string) => NextResponse.redirect(new URL(path, env.NEXT_PUBLIC_APP_URL));
  const session = await getAuth().api.getSession({ headers: request.headers });
  const token = getSessionCookie(request.headers);
  if (session?.user.role !== "demo" || !token) return to("/admin/login");
  const [sandbox] = await publicDb
    .select()
    .from(demoSandboxes)
    .where(and(eq(demoSandboxes.userId, session.user.id), gt(demoSandboxes.expiresAt, new Date())));
  if (!sandbox) return to("/demo?ended=1");
  const response = to("/admin");
  setSandboxCookie(response.cookies, authSecret(), sandbox.id, sandbox.expiresAt, token);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
