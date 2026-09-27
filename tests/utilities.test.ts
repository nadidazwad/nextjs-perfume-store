import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createId } from "../src/lib/id";
import { slugify } from "../src/lib/slug";
import { formatMoney, calcDiscountPercent } from "../src/lib/money";
import { normalizePhone, isValidPhone, formatPhone } from "../src/lib/phone";
import { storeConfig, storeConfigSchema, validateStoreConfig } from "../store.config";

test("money uses configured symbols and integer minor units", () => {
  assert.equal(formatMoney(37500), "৳37,500");
  const usd = { ...storeConfig.currency, code: "USD", symbol: "$", minorUnits: 2 as const };
  assert.equal(formatMoney(37500, usd), "$375.00");
  assert.equal(formatMoney(-105, usd), "-$1.05");
  assert.equal(formatMoney(0, usd), "$0.00");
  assert.equal(formatMoney(123456, { ...usd, symbolPosition: "after", thousandsSeparator: " " }), "1 234.56$");
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER, usd), "$90,071,992,547,409.91");
  for (const value of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => formatMoney(value));
  assert.equal(calcDiscountPercent(100, 64), 36);
  assert.equal(calcDiscountPercent(3, 2), 33);
  assert.equal(calcDiscountPercent(0, 0), 0);
  assert.equal(calcDiscountPercent(100, 120), 0);
  assert.throws(() => calcDiscountPercent(100, -1));
});
test("Bangladesh phone normalization rejects invalid prefixes and lengths", () => {
  for (const input of ["01712345678", "+8801712345678", "+880 1712-345678", " (01712) 345678 "]) {
    assert.equal(normalizePhone(input), "+8801712345678");
  }
  assert.equal(formatPhone("01712345678"), "+880 1712-345678");
  for (const input of ["01212345678", "0171234567", "017123456789", "1712345678", "+11712345678", "01712x45678", "", "++8801712345678"]) {
    assert.equal(isValidPhone(input), false);
    assert.throws(() => normalizePhone(input));
  }
});
test("slugs and random IDs are URL safe", () => {
  assert.equal(slugify("  Café & Amber / 100 ml  "), "cafe-amber-100-ml");
  assert.throws(() => slugify(" / "));
  const ids = Array.from({ length: 1000 }, createId);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, /^[A-Za-z0-9_-]{21}$/));
});

test("theme bridge maps config colors/radii and contrasting foregrounds", async () => {
  const { themeVariables, contrastForeground } = await import("../src/lib/theme");
  const vars = themeVariables({ primary: "#ffffff", deal: "#000000", radius: "none" });
  assert.equal(vars["--store-primary"], "#ffffff");
  assert.equal(vars["--store-primary-foreground"], "#000000");
  assert.equal(vars["--store-deal-foreground"], "#ffffff");
  assert.equal(vars["--store-radius"], "0rem");
  assert.equal(contrastForeground(storeConfig.theme.primary), "#ffffff");
  assert.equal(contrastForeground(storeConfig.theme.deal), "#ffffff");
});
test("production env requires an explicit https store URL (localhost excepted)", () => {
  const check = (url?: string) => {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH, NODE_ENV: "production",
      DATABASE_URL: "postgres://u:p@db.example/x", BETTER_AUTH_SECRET: "0123456789abcdef0123",
    };
    if (url) env.NEXT_PUBLIC_APP_URL = url;
    const run = spawnSync(process.execPath, ["--import", "tsx", "-e", 'require("./src/lib/env").env.NODE_ENV'], { env, encoding: "utf8" });
    return run.status === 0 ? "ok" : run.stderr;
  };
  assert.match(check(), /Required in production: your store.s public https[\s\S]*NEXT_PUBLIC_APP_URL/);
  assert.match(check("http://shop.example.com"), /Must use https/);
  assert.equal(check("https://shop.example.com"), "ok");
  assert.equal(check("http://localhost:3000"), "ok");
});
test("store.config.ts validates, and a broken value is reported", () => {
  assert.doesNotThrow(validateStoreConfig);
  const broken = { ...storeConfig, theme: { ...storeConfig.theme, primary: "red" } };
  assert.equal(storeConfigSchema().safeParse(broken).success, false);
});
