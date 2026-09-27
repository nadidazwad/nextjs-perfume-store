import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";
import { validateObjectKey } from "./local";
function client() {
  return new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    service: "s3",
    region: env.S3_REGION,
    retries: 2,
  });
}
function url(key: string) {
  validateObjectKey(key);
  return `${env.S3_ENDPOINT!.replace(/\/$/, "")}/${encodeURIComponent(env.S3_BUCKET!)}/${key}`;
}
export const s3StorageAdapter = {
  async putObject(buffer: Uint8Array, key: string) {
    const response = await client().fetch(url(key), {
      method: "PUT",
      body: new Uint8Array(buffer),
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("Storage upload failed.");
    return `${env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
  },
  async deleteObject(key: string) {
    const response = await client().fetch(url(key), {
      method: "DELETE",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok && response.status !== 404)
      throw new Error("Storage deletion failed.");
  },
};
