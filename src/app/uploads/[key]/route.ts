import { localStorageAdapter } from "@/lib/storage/local";
import { getSandboxUpload, isSandboxUploadKey } from "@/lib/demo/uploads";
import { env } from "@/lib/env";

/** Serves images saved by the local storage adapter. Keys are random, so responses never change. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // Public demo: a visitor's own uploads, from their sandbox only, never shared by a cache.
  if (env.DEMO_MODE && isSandboxUploadKey(key)) {
    const bytes = await getSandboxUpload(key);
    return bytes
      ? new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" } })
      : new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const bytes = await localStorageAdapter.getObject(key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
