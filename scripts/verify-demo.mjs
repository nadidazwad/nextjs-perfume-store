// Phase 7 Gate: two visitors in separate browsers each start a demo store,
// edit the same product, upload an image and place an order; each sees only
// their own changes, a second device joins with the generated login, a third
// anonymous visitor sees nothing and can't order; Reset and End work.
//
//   npm i --prefix /tmp/pw playwright-core   # not a project dependency
//   BASE=https://your-demo.example PRODUCT_ID=… PRODUCT_SLUG=… UPLOAD_FILE=photo.png \
//   CHROMIUM_PATH=/path/to/chrome NODE_PATH=/tmp/pw/node_modules node scripts/verify-demo.mjs
//
// Starting demos is limited to 3 per IP per hour; the last check uses all 3.
// SKIP_RATE_CHECK=1 stops before it (e.g. behind a NAT whose public IP rotates).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright-core");

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? "/tmp/attar-verify-demo";
const PRODUCT = { id: process.env.PRODUCT_ID, slug: process.env.PRODUCT_SLUG };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
const errors = [];
async function visitor(label, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 780 : 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${label} console: ${m.text()}`));
  return { context, page, label };
}
const shot = (v, name) => v.page.screenshot({ path: `${OUT}/${v.label}-${name}.png`, fullPage: false });
const step = (message) => console.log(`• ${message}`);

async function start(v) {
  await v.page.goto(`${BASE}/demo`);
  await shot(v, "01-demo");
  const t = Date.now();
  await v.page.getByRole("button", { name: "Start my demo store" }).click();
  await v.page.getByRole("heading", { name: "Your demo store is ready" }).waitFor({ timeout: 20_000 });
  step(`${v.label}: sandbox started in ${Date.now() - t} ms (click → credentials)`);
  await shot(v, "02-credentials");
  const email = await v.page.locator(".demo-credentials dd").first().textContent();
  const password = await v.page.locator(".demo-credentials dd").nth(1).textContent();
  await v.page.getByRole("link", { name: "Open the admin" }).click();
  await v.page.waitForURL(/\/admin$/);
  await v.page.locator(".demo-bar[data-state=live]").waitFor();
  await shot(v, "03-admin");
  return { email, password };
}
async function renameProduct(v, name) {
  await v.page.goto(`${BASE}/admin/products/${PRODUCT.id}`);
  const input = v.page.getByLabel("Product name");
  await input.fill(name);
  await v.page.getByRole("button", { name: "Save changes" }).first().click();
  await v.page.waitForTimeout(1500);
  await shot(v, "04-product-saved");
}
async function order(v, customer) {
  await v.page.goto(`${BASE}/products/${PRODUCT.slug}`);
  await v.page.getByRole("button", { name: "Add to bag" }).first().click();
  await v.page.waitForTimeout(800);
  await v.page.goto(`${BASE}/checkout`);
  await v.page.locator("#name").fill(customer);
  await v.page.locator("#phone").fill("01712345678");
  await v.page.locator("#line1").fill("House 1, Road 2");
  await v.page.locator("#area").fill("Dhanmondi");
  await v.page.locator("#city").fill("Dhaka");
  await v.page.getByRole("button", { name: "Place order" }).click();
  await v.page.waitForURL(/\/order\/confirmed\//, { timeout: 20_000 });
  const number = decodeURIComponent(v.page.url().split("/").pop());
  await shot(v, "05-order-confirmed");
  return number;
}
const pdpTitle = async (v) => {
  await v.page.goto(`${BASE}/products/${PRODUCT.slug}`);
  return (await v.page.locator("h1").first().textContent())?.trim();
};
const adminHasOrder = async (v, number) => {
  await v.page.goto(`${BASE}/admin/orders?q=${encodeURIComponent(number)}`);
  return (await v.page.getByText(number).count()) > 0;
};

const a = await visitor("A-360", 360);
const b = await visitor("B-1440", 1440);
const c = await visitor("C-anon", 1440);
const original = await pdpTitle(c);
step(`anonymous sees "${original}"`);
const loginA = await start(a);
await start(b);
await renameProduct(a, "Visitor A Edition");
await renameProduct(b, "Visitor B Edition");
const orderA = await order(a, "Visitor A Customer");
const orderB = await order(b, "Visitor B Customer");
step(`orders: A ${orderA}, B ${orderB}`);

// A uploads an image into their sandbox and adds it to the product.
await a.page.goto(`${BASE}/admin/products/${PRODUCT.id}`);
await a.page.locator('input[type="file"]').setInputFiles(process.env.UPLOAD_FILE);
await a.page.locator('img[src*="/uploads/sbx-"]').first().waitFor({ timeout: 20_000 });
await a.page.getByRole("button", { name: "Save changes" }).first().click();
await a.page.waitForTimeout(1500);
await shot(a, "04b-uploaded");
const sandboxImages = async (v) => {
  await v.page.goto(`${BASE}/products/${PRODUCT.slug}`);
  const srcs = await v.page.locator('img[src*="/uploads/sbx-"]').evaluateAll((els) => els.map((el) => el.getAttribute("src")));
  if (!srcs.length) return { count: 0 };
  const status = await v.page.evaluate(async (src) => (await fetch(src)).status, srcs[0]);
  return { count: srcs.length, status, src: srcs[0] };
};

// A signs in with the generated login on "another device".
const f = await visitor("F-device2", 1440);
await f.page.goto(`${BASE}/admin/login`);
await f.page.getByLabel("Email").fill(loginA.email);
await f.page.getByLabel("Password", { exact: true }).fill(loginA.password);
await f.page.getByRole("button", { name: /sign in/i }).click();
await f.page.locator(".demo-bar[data-state=live]").waitFor({ timeout: 20_000 });
await shot(f, "03-admin-second-device");

const results = {
  "A's second device lands in A's sandbox": (await pdpTitle(f)).includes("Visitor A Edition"),
  "A sees A's product name": (await pdpTitle(a)).includes("Visitor A Edition"),
  "B sees B's product name": (await pdpTitle(b)).includes("Visitor B Edition"),
  "anonymous sees the original name": (await pdpTitle(c)) === original,
  "A's admin lists A's order": await adminHasOrder(a, orderA),
  "B's admin lists B's order": await adminHasOrder(b, orderB),
};
const imgA = await sandboxImages(a);
results["A's storefront shows A's uploaded image (200)"] = imgA.count > 0 && imgA.status === 200;
const imgC = await sandboxImages(c);
results["anonymous storefront has no sandbox image"] = imgC.count === 0;
if (imgA.src) {
  const direct = await c.page.evaluate(async (src) => (await fetch(src)).status, imgA.src);
  results["anonymous fetching A's image URL gets 404"] = direct === 404;
}
// Same order number in both sandboxes is expected (each has its own sequence): check by customer name.
await a.page.goto(`${BASE}/admin/orders`);
results["A's admin doesn't show B's customer"] = (await a.page.getByText("Visitor B Customer").count()) === 0;
results["A's admin shows A's customer"] = (await a.page.getByText("Visitor A Customer").count()) > 0;
await shot(a, "06-orders");
await b.page.goto(`${BASE}/admin/orders`);
results["B's admin doesn't show A's customer"] = (await b.page.getByText("Visitor A Customer").count()) === 0;
await shot(b, "06-orders");
// Anonymous visitors can't write to the original demo.
await c.page.goto(`${BASE}/products/${PRODUCT.slug}`);
await c.page.getByRole("button", { name: "Add to bag" }).first().click();
await c.page.waitForTimeout(800);
await c.page.goto(`${BASE}/checkout`);
for (const [id, value] of [["name", "Stranger"], ["phone", "01712345678"], ["line1", "Road 1"], ["area", "Gulshan"], ["city", "Dhaka"]])
  await c.page.locator(`#${id}`).fill(value);
await c.page.getByRole("button", { name: "Place order" }).click();
await c.page.getByText("This is a demo store. Start your own demo store").waitFor({ timeout: 15_000 });
results["anonymous checkout is refused"] = !c.page.url().includes("/order/confirmed/");
await shot(c, "07b-checkout-refused");
await c.page.goto(`${BASE}/admin`);
results["anonymous is sent to the admin login"] = c.page.url().includes("/admin/login");
await c.page.goto(`${BASE}/`);
await shot(c, "07-home-visitor-bar");

// Storefront bar for a sandbox visitor, both widths.
await a.page.goto(`${BASE}/`);
await shot(a, "08-home-live-bar");
await b.page.goto(`${BASE}/`);
await shot(b, "08-home-live-bar");

// Reset A: back to the original name, still signed in.
await a.page.goto(`${BASE}/admin`);
await a.page.locator(".demo-bar").getByRole("button", { name: "Reset" }).click();
await a.page.waitForTimeout(300);
await shot(a, "09-reset-confirm");
await a.page.locator(".demo-bar").getByRole("button", { name: "Reset" }).click();
await a.page.waitForTimeout(2500);
results["after Reset, A sees the original name"] = (await pdpTitle(a)) === original;
results["after Reset, B still sees B's name"] = (await pdpTitle(b)).includes("Visitor B Edition");

// End B: sandbox and login gone, back to the public store.
await b.page.goto(`${BASE}/admin`);
await b.page.locator(".demo-bar").getByRole("button", { name: "End" }).click();
await b.page.locator(".demo-bar").getByRole("button", { name: "End demo" }).click();
await b.page.waitForURL(/\/demo\?ended=0/, { timeout: 15_000 });
await shot(b, "10-ended");
results["after End, B sees the original name"] = (await pdpTitle(b)) === original;
await b.page.goto(`${BASE}/admin`);
results["after End, B is signed out"] = b.page.url().includes("/admin/login");

// Per-IP start limit (3 an hour): A and B used two; one more works, the next is refused.
if (process.env.SKIP_RATE_CHECK) {
  for (const [check, ok] of Object.entries(results)) console.log(`${ok ? "PASS" : "FAIL"}  ${check}`);
  console.log(errors.length ? `page errors:\n${errors.join("\n")}` : "no page errors");
  await browser.close();
  process.exit(Object.values(results).every(Boolean) ? 0 : 1);
}
const d = await visitor("D-360", 360);
await start(d);
const e = await visitor("E-360", 360);
await e.page.goto(`${BASE}/demo`);
await e.page.getByRole("button", { name: "Start my demo store" }).click();
await e.page.locator(".demo-start .field-error").waitFor({ timeout: 15_000 });
results["4th start from one IP within an hour is refused"] = /3 demos in the last hour/.test(await e.page.locator(".demo-start .field-error").textContent());
await shot(e, "11-rate-limited");

for (const [check, ok] of Object.entries(results)) console.log(`${ok ? "PASS" : "FAIL"}  ${check}`);
console.log(errors.length ? `page errors:\n${errors.join("\n")}` : "no page errors");
await browser.close();
process.exit(Object.values(results).every(Boolean) && !errors.length ? 0 : 1);
