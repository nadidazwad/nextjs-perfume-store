"use server";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, gt } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getSessionCookie, parseSetCookieHeader } from "better-auth/cookies";
import { publicDb } from "@/db";
import { account, demoSandboxes, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { authSecret, env } from "@/lib/env";
import { createId } from "@/lib/id";
import { clientIp, takeRateLimit } from "@/lib/rate-limit";
import { SANDBOX_COOKIE } from "./cookie";
import { createSandbox, dropSandboxes, resetSandbox } from "./sandbox";
import { requestSandbox, setSandboxCookie } from "./session";

/**
 * The public demo's only entry points (DEMO_MODE). None takes arguments. Start
 * is rate limited per IP; reset and end act only on the sandbox the caller's
 * own session-bound cookie routes to; resume only on the signed-in demo user's.
 */
export type DemoStart =
  | { ok: true; email: string; password: string; expiresAt: string }
  | { ok: false; message: string };
type Result = { ok: boolean; message: string };
const unavailable = { ok: false as const, message: "The demo isn't available on this site." };

export async function startDemo(): Promise<DemoStart> {
  if (!env.DEMO_MODE) return unavailable;
  const source = await headers();
  if (!(await takeRateLimit("demo-start", clientIp(source), 3, 60 * 60_000)))
    return { ok: false, message: "You've started 3 demos in the last hour. Please try again later." };
  const userId = createId();
  const email = `demo-${randomBytes(5).toString("hex")}@demo.invalid`;
  const password = randomBytes(12).toString("base64url");
  await publicDb.transaction(async (tx) => {
    await tx.insert(user).values({ id: userId, name: "Demo visitor", email, emailVerified: true, role: "demo" });
    await tx.insert(account).values({ userId, accountId: userId, providerId: "credential", password: await hashPassword(password) });
  });
  let sandbox: Awaited<ReturnType<typeof createSandbox>>;
  try {
    sandbox = await createSandbox(userId);
  } catch (error) {
    await publicDb.delete(user).where(eq(user.id, userId));
    console.error("Demo sandbox creation failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: "We couldn't start a demo right now. Please try again in a minute." };
  }
  const response = await getAuth().api.signInEmail({ body: { email, password }, headers: source, asResponse: true });
  const jar = await cookies();
  let session: string | undefined;
  for (const [name, cookie] of parseSetCookieHeader(response.headers.get("set-cookie") ?? "")) {
    if (name.endsWith("session_token")) session = cookie.value;
    jar.set(name, cookie.value, {
      httpOnly: cookie.httponly,
      secure: cookie.secure,
      sameSite: cookie.samesite?.toLowerCase() as "lax" | "strict" | "none" | undefined,
      path: cookie.path ?? "/",
      // The admin session ends with the sandbox.
      expires: sandbox.expiresAt,
    });
  }
  if (!session) {
    await dropSandboxes([sandbox.id]);
    return { ok: false, message: "We couldn't sign you in. Please try again." };
  }
  setSandboxCookie(jar, authSecret(), sandbox.id, sandbox.expiresAt, session);
  return { ok: true, email, password, expiresAt: sandbox.expiresAt.toISOString() };
}

export async function resetDemo(): Promise<Result> {
  if (!env.DEMO_MODE) return unavailable;
  const source = await headers();
  const sandbox = await requestSandbox(source);
  const session = getSessionCookie(source);
  if (!sandbox || !session) return { ok: false, message: "This demo sandbox has ended." };
  if (!(await takeRateLimit("demo-reset", sandbox.userId, 10, 60 * 60_000)))
    return { ok: false, message: "That's a lot of resets. Please wait a few minutes." };
  try {
    const fresh = await resetSandbox(sandbox.id, sandbox.userId);
    setSandboxCookie(await cookies(), authSecret(), fresh.id, fresh.expiresAt, session);
  } catch {
    return { ok: false, message: "This demo sandbox has ended." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Your demo store is back to the original." };
}

export async function endDemo(): Promise<Result> {
  if (!env.DEMO_MODE) return unavailable;
  const source = await headers();
  const sandbox = await requestSandbox(source);
  if (sandbox) await dropSandboxes([sandbox.id]); // also deletes the demo user and its sessions
  const jar = await cookies();
  // Browsers ignore a __Secure- cookie deletion that isn't itself Secure.
  for (const { name } of jar.getAll())
    if (name === SANDBOX_COOKIE || name.includes("better-auth.session"))
      jar.set(name, "", { path: "/", expires: new Date(0), secure: name.startsWith("__Secure-") || undefined });
  revalidatePath("/", "layout");
  return { ok: true, message: "Your demo sandbox has been deleted." };
}

/**
 * Signed in with the demo login elsewhere (another device, or after signing
 * out): the session has no sandbox cookie yet. Issue it for the visitor's own
 * live sandbox, bound to this session. /demo/resume calls this.
 */
export async function resumeDemo(): Promise<Result> {
  if (!env.DEMO_MODE) return unavailable;
  const source = await headers();
  const session = await getAuth().api.getSession({ headers: source });
  const token = getSessionCookie(source);
  if (session?.user.role !== "demo" || !token) return { ok: false, message: "Sign in with your demo login first." };
  const [sandbox] = await publicDb
    .select()
    .from(demoSandboxes)
    .where(and(eq(demoSandboxes.userId, session.user.id), gt(demoSandboxes.expiresAt, new Date())));
  if (!sandbox) return { ok: false, message: "This demo store has ended and was deleted." };
  setSandboxCookie(await cookies(), authSecret(), sandbox.id, sandbox.expiresAt, token);
  return { ok: true, message: "" };
}
