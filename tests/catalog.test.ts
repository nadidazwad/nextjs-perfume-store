import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalogParams, catalogHref } from "../src/lib/catalog/params";
test("catalog parameters retain valid fields and reject malformed values", () => {
  const p = parseCatalogParams({
    gender: "men",
    concentration: ["oil", "attar"],
    minPrice: "-1",
    maxPrice: "2000",
    sort: "bad",
    page: "0",
    inStock: "true",
  });
  assert.deepEqual(p.gender, ["men"]);
  assert.deepEqual(p.concentration, ["oil", "attar"]);
  assert.equal(p.minPrice, undefined);
  assert.equal(p.maxPrice, 2000);
  assert.equal(p.sort, "newest");
  assert.equal(p.page, 1);
  assert.equal(p.inStock, true);
});
test("filter links preserve repeated values and clear page", () => {
  assert.equal(
    catalogHref(
      "/products",
      { gender: ["men", "women"], page: "2", q: "rose & oud" },
      { page: undefined, gender: ["women"] },
    ),
    "/products?gender=women&q=rose+%26+oud",
  );
});
