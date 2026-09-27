import assert from "node:assert/strict";
import { test } from "node:test";
import { consoleAdapter } from "../src/lib/notify/console";

test("notification adapters serialize plain text and isolate provider failures", async () => {
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.NOTIFY_ADAPTER = "resend";
  process.env.RESEND_API_KEY = "fixture-key";
  process.env.NOTIFY_EMAIL_FROM = "orders@example.com";
  process.env.NOTIFY_EMAIL_TO = "team@example.com";
  process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
  process.env.TELEGRAM_CHAT_ID = "fixture-chat";
  const { resendAdapter } = await import("../src/lib/notify/resend");
  const { telegramAdapter } = await import("../src/lib/notify/telegram");
  const { notifyTestPing } = await import("../src/lib/notify");
  const fetchOriginal = globalThis.fetch,
    errorOriginal = console.error,
    infoOriginal = console.info;
  const sent: { url: string; data: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  try {
    globalThis.fetch = async (url, init) => {
      sent.push({ url: String(url), data: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ ok: true, id: "fixture" }), {
        status: 200,
      });
    };
    await resendAdapter.send("Order <test>", "One & two");
    assert.equal(sent[0].url, "https://api.resend.com/emails");
    assert.equal(sent[0].data.text, "One & two");
    assert.deepEqual(sent[0].data.to, ["team@example.com"]);
    await telegramAdapter.send("Order", "One & two");
    assert.equal(sent[1].data.chat_id, "fixture-chat");
    assert.equal(sent[1].data.text, "Order\nOne & two");
    assert.equal(sent[1].data.parse_mode, undefined);
    globalThis.fetch = async () => {
      throw new Error("secret must not be logged");
    };
    console.error = (...args) => {
      logs.push(args.join(" "));
    };
    await assert.doesNotReject(notifyTestPing());
    assert.equal(logs.length, 1);
    assert.ok(!logs[0].includes("secret"));
    console.info = (...args) => {
      logs.push(args.join(" "));
    };
    await consoleAdapter.send("Fixture order", "Summary");
    assert.match(logs[1], /Fixture order\nSummary/);
  } finally {
    globalThis.fetch = fetchOriginal;
    console.error = errorOriginal;
    console.info = infoOriginal;
  }
});
test("redacted order alerts omit customer contact details", async () => {
  const { orderNotificationText } = await import("../src/lib/notify");
  const notification = {
    order: {
      id: "order-1", orderNumber: "ATR-1001", customerName: "Fixture Buyer", customerPhone: "+8801712345678",
      shippingAddress: { line1: "12 Fixture Road", area: "Dhanmondi", city: "Dhaka", zone_id: "inside" },
      discount: 0, couponCode: null, deliveryFee: 6000, total: 256000, paymentMethod: "bkash", paymentTxnId: "TRX123",
    },
    items: [{ quantity: 2, brandName: "Meral House", productName: "Rain", variantLabel: "50 ml", lineTotal: 250000 }],
  } as unknown as Parameters<typeof orderNotificationText>[0];
  const full = orderNotificationText(notification, { redact: false });
  assert.match(full, /Fixture Buyer \| \+8801712345678/);
  const redacted = orderNotificationText(notification, { redact: true });
  for (const secret of ["Fixture Buyer", "8801712345678", "Fixture Road", "TRX123"])
    assert.ok(!redacted.includes(secret), `leaked ${secret}`);
  assert.match(redacted, /2 item\(s\)/);
  assert.match(redacted, /\/admin\/orders\/order-1/);
});
