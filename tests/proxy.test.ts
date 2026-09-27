import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy, config } from "../src/proxy";
import { basePolicy, pagePolicy } from "../src/lib/csp";

const policyNonce = (policy: string | null) => policy?.match(/'nonce-([^']+)'/)?.[1];

test("every page response gets a fresh script nonce, passed to rendering and the browser", () => {
  const first = proxy(new NextRequest("http://localhost/products"));
  const second = proxy(new NextRequest("http://localhost/products"));
  const nonce = policyNonce(first.headers.get("content-security-policy"));
  assert.ok(nonce && nonce.length >= 24);
  assert.notEqual(policyNonce(second.headers.get("content-security-policy")), nonce);
  // One header on page responses, so it must carry the base directives too.
  assert.ok(first.headers.get("content-security-policy")!.startsWith(`${basePolicy}; script-src 'self' 'nonce-`));
  assert.match(first.headers.get("content-security-policy")!, /'strict-dynamic'$/);
  // Next reads the nonce from the forwarded request headers.
  assert.equal(first.headers.get("x-middleware-request-x-nonce"), nonce);
  assert.match(first.headers.get("x-middleware-request-content-security-policy") ?? "", new RegExp(`nonce-${nonce!.replace(/[+/=]/g, "\\$&")}`));
});

test("the admin still redirects without a session cookie, and sign-in gets a nonce", () => {
  const redirect = proxy(new NextRequest("http://localhost/admin/orders"));
  assert.equal(redirect.status, 307);
  assert.equal(new URL(redirect.headers.get("location")!).pathname, "/admin/login");
  assert.ok(policyNonce(proxy(new NextRequest("http://localhost/admin/login")).headers.get("content-security-policy")));
});

test("the policy never allows eval or inline scripts in production, and skips assets", () => {
  assert.doesNotMatch(pagePolicy("n"), /unsafe/);
  const source = new RegExp(`^${config.matcher[0].source}$`);
  for (const path of ["/", "/products/cedar-interval", "/admin", "/demo", "/wishlist"]) assert.ok(source.test(path), path);
  for (const path of ["/api/search/suggest", "/_next/static/chunks/a.js", "/_next/image", "/uploads/sbx-1.webp", "/robots.txt", "/seed/a.svg", "/favicon.ico"])
    assert.ok(!source.test(path), path);
});
