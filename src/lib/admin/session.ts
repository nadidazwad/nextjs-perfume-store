import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { publicDb } from "@/db";
import { currentSandboxId } from "@/db/sandbox-router";
import { demoSandboxes } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
export async function adminSession(requestHeaders?: Headers) {
  const source = requestHeaders ?? (await headers());
  const session = await getAuth().api.getSession({ headers: source });
  if (session?.user.role === "admin") return session;
  // A demo visitor (DEMO_MODE only) is let in only while this request is routed
  // to their own live sandbox, so their edits can never reach the real store.
  if (session?.user.role === "demo" && env.DEMO_MODE && (await routedToOwnSandbox(session.user.id, source)))
    return session;
  return null;
}
async function routedToOwnSandbox(userId: string, source: Headers) {
  const id = await currentSandboxId(source);
  if (!id) return false;
  const [row] = await publicDb
    .select({ id: demoSandboxes.id })
    .from(demoSandboxes)
    .where(and(eq(demoSandboxes.id, id), eq(demoSandboxes.userId, userId), gt(demoSandboxes.expiresAt, new Date())));
  return Boolean(row);
}
export async function requireAdmin() {
  const session = await adminSession();
  if (!session) redirect("/admin/login");
  return session.user;
}
