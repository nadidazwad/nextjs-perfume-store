import { and, eq, gt } from "drizzle-orm";
import { publicDb } from "@/db";
import { currentSandboxId } from "@/db/sandbox-router";
import { demoSandboxes } from "@/db/schema";
import { env } from "@/lib/env";
import { SANDBOX_COOKIE, readCookie, signSandboxCookie } from "./cookie";

/** The live sandbox this request is routed to (DEMO_MODE only), or null. */
export async function requestSandbox(source: Headers) {
  if (!env.DEMO_MODE) return null;
  const id = await currentSandboxId(source);
  if (!id) return null;
  const [row] = await publicDb
    .select()
    .from(demoSandboxes)
    .where(and(eq(demoSandboxes.id, id), gt(demoSandboxes.expiresAt, new Date())));
  return row ?? null;
}

/** A sandbox cookie is present but no longer routes anywhere (ended, expired or signed out). */
export const hasStaleSandboxCookie = (source: Headers) => Boolean(readCookie(source.get("cookie"), SANDBOX_COOKIE));

type CookieJar = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };
const secure = () => new URL(env.NEXT_PUBLIC_APP_URL).protocol === "https:";

/** Issues the sandbox cookie bound to this admin session cookie value. */
export function setSandboxCookie(jar: CookieJar, secret: string, id: string, expiresAt: Date, sessionCookie: string) {
  jar.set(SANDBOX_COOKIE, signSandboxCookie(secret, id, expiresAt, sessionCookie), {
    httpOnly: true,
    sameSite: "lax",
    secure: secure(),
    path: "/",
    expires: expiresAt,
  });
}
