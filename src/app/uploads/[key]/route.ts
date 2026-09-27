import { localStorageAdapter } from "@/lib/storage/local";

/** Serves images saved by the local storage adapter. Keys are random, so responses never change. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
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
