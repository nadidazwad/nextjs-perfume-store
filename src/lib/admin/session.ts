import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { requestSandbox } from "@/lib/demo/session";
import { env } from "@/lib/env";
export async function adminSession(requestHeaders?: Headers) {
  const source = requestHeaders ?? (await headers());
  const session = await getAuth().api.getSession({ headers: source });
  if (session?.user.role === "admin") return session;
  // A demo visitor (DEMO_MODE only) is let in only while this request is routed
  // to their own live sandbox, so their edits can never reach the real store.
  if (session?.user.role === "demo" && env.DEMO_MODE && (await requestSandbox(source))?.userId === session.user.id)
    return session;
  return null;
}
export async function requireAdmin() {
  const session = await adminSession();
  if (session) return session.user;
  if (env.DEMO_MODE) {
    // Signed in as a demo visitor without the sandbox cookie (e.g. another device).
    const visitor = await getAuth().api.getSession({ headers: await headers() });
    if (visitor?.user.role === "demo") redirect("/demo/resume");
  }
  redirect("/admin/login");
}
