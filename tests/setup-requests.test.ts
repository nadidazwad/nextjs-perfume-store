import assert from "node:assert/strict";
import { test } from "node:test";
import { setupRequestSchema } from "../src/lib/setup-requests/schema";
import { setupPlanTitle } from "../src/lib/setup-requests/plans";

const valid = { name: "Rahim", business: "Oud House", contact: "01711-223344", plan: "setup" };

test("setup request: accepts a phone or an email and trims optional fields to null", () => {
  const parsed = setupRequestSchema.parse({ ...valid, link: "  ", message: "" });
  assert.equal(parsed.link, null);
  assert.equal(parsed.message, null);
  assert.ok(setupRequestSchema.safeParse({ ...valid, contact: "owner@oudhouse.com" }).success);
});

test("setup request: rejects contacts nobody can reply to, unknown plans and oversize input", () => {
  for (const contact of ["", "call me", "12345"])
    assert.equal(setupRequestSchema.safeParse({ ...valid, contact }).success, false, contact);
  assert.equal(setupRequestSchema.safeParse({ ...valid, plan: "free" }).success, false);
  assert.equal(setupRequestSchema.safeParse({ ...valid, message: "x".repeat(1501) }).success, false);
  assert.equal(setupRequestSchema.safeParse({ ...valid, name: " " }).success, false);
});

test("setup request: plan titles fall back to the raw value", () => {
  assert.equal(setupPlanTitle("custom"), "A custom design for my brand");
  assert.equal(setupPlanTitle("legacy"), "legacy");
});
