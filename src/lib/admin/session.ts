import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
export async function adminSession(requestHeaders?: Headers) {
  const session = await getAuth().api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  return session?.user.role === "admin" ? session : null;
}
export async function requireAdmin() {
  const session = await adminSession();
  if (!session) redirect("/admin/login");
  return session.user;
}
