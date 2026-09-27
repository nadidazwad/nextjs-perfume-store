import { randomUUID } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sandboxUploads } from "@/db/schema";

/**
 * Demo visitors' images live in their sandbox (DEMO_MODE). Keys start with
 * `sbx-` so the storefront serves them without the image optimizer, which
 * fetches without the visitor's cookies and so can't see their sandbox.
 */
export const SANDBOX_UPLOAD_LIMIT = 30;
export class SandboxUploadError extends Error {}
export const isSandboxUploadKey = (key: string) => /^sbx-[a-zA-Z0-9-]+\.webp$/.test(key);

/** Caller must have checked the request is a demo admin routed to their own sandbox. */
export async function putSandboxUpload(bytes: Uint8Array) {
  const key = `sbx-${randomUUID()}.webp`;
  await db.transaction(async (tx) => {
    // Belt and braces: never write an upload anywhere but a sandbox schema.
    const [where] = await tx.select({ schema: sql<string>`current_schema()` }).from(sql`(select 1) as here`);
    if (!where?.schema?.startsWith("demo_")) throw new SandboxUploadError("Not in a demo sandbox.");
    const [{ n }] = await tx.select({ n: count() }).from(sandboxUploads);
    if (n >= SANDBOX_UPLOAD_LIMIT)
      throw new SandboxUploadError(`The demo keeps up to ${SANDBOX_UPLOAD_LIMIT} images. Reuse or delete some first.`);
    await tx.insert(sandboxUploads).values({ key, bytes });
  });
  return { key, url: `/uploads/${key}` };
}

/** Bytes from the current request's sandbox; null elsewhere (public never has any). */
export async function getSandboxUpload(key: string) {
  if (!isSandboxUploadKey(key)) return null;
  const [row] = await db.select({ bytes: sandboxUploads.bytes }).from(sandboxUploads).where(eq(sandboxUploads.key, key));
  return row?.bytes ?? null;
}
