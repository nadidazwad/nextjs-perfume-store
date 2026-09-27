import { randomUUID } from "node:crypto";
import { adminSession } from "@/lib/admin/session";
import { getStorage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, validateImage } from "@/lib/storage/image";
import { takeRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const session = await adminSession(request.headers);
  if (!session)
    return Response.json(
      { error: "Sign in as an administrator." },
      { status: 401 },
    );
  if (request.headers.get("origin") !== new URL(env.NEXT_PUBLIC_APP_URL).origin)
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await takeRateLimit("upload", session.user.id, 60)))
    return Response.json(
      { error: "Too many uploads. Try again later." },
      { status: 429 },
    );
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_UPLOAD_BYTES + 65536)
    return Response.json(
      { error: "Choose an image under 5 MB." },
      { status: 413 },
    );
  try {
    // Bound streaming bodies as well as requests with a Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_UPLOAD_BYTES + 65536) {
        await reader.cancel();
        return Response.json(
          { error: "Choose an image under 5 MB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const data = await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Missing image.");
    const bytes = await validateImage(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    const key = `${randomUUID()}.webp`;
    const url = await getStorage().putObject(bytes, key);
    return Response.json({ url, key });
  } catch {
    return Response.json(
      {
        error:
          "Upload failed. Use a valid JPEG, PNG or WebP under 5 MB and check storage settings.",
      },
      { status: 400 },
    );
  }
}
