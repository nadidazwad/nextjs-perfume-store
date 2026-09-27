import assert from "node:assert/strict";
import { test } from "node:test";

Object.assign(process.env, {
  NODE_ENV: "test",
  STORAGE_ADAPTER: "s3",
  S3_ENDPOINT: "https://account.r2.cloudflarestorage.com/",
  S3_REGION: "auto",
  S3_BUCKET: "attar-uploads",
  S3_ACCESS_KEY_ID: "fixture-key",
  S3_SECRET_ACCESS_KEY: "fixture-secret",
  S3_PUBLIC_URL: "https://pub-fixture.r2.dev/",
});

test("the s3 adapter signs path-style requests and returns public URLs", async () => {
  const { getStorage } = await import("../src/lib/storage");
  const original = globalThis.fetch;
  const seen: Request[] = [];
  try {
    globalThis.fetch = async (input, init) => {
      seen.push(new Request(input as RequestInfo, init));
      return new Response(null, { status: 200 });
    };
    const url = await getStorage().putObject(new Uint8Array([1, 2, 3]), "abc-123.webp");
    assert.equal(url, "https://pub-fixture.r2.dev/abc-123.webp");
    const put = seen[0];
    assert.equal(put.method, "PUT");
    assert.equal(put.url, "https://account.r2.cloudflarestorage.com/attar-uploads/abc-123.webp");
    assert.match(put.headers.get("authorization") ?? "", /^AWS4-HMAC-SHA256 Credential=fixture-key\/\d{8}\/auto\/s3\/aws4_request/);
    assert.equal(put.headers.get("content-type"), "image/webp");
    assert.ok(put.headers.get("x-amz-content-sha256"));
    await getStorage().deleteObject("abc-123.webp");
    assert.equal(seen[1].method, "DELETE");
    await assert.rejects(getStorage().putObject(new Uint8Array([1]), "../escape.webp"), /Invalid storage key/);
    assert.equal(seen.length, 2, "invalid keys never reach the network");
    globalThis.fetch = async () => new Response("SignatureDoesNotMatch", { status: 403 });
    await assert.rejects(getStorage().putObject(new Uint8Array([1]), "abc-124.webp"), /Storage upload failed/);
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.doesNotReject(getStorage().deleteObject("gone.webp"));
  } finally {
    globalThis.fetch = original;
  }
});
