/** Run with the dev server stopped: pnpm catalog:verify */
import assert from "node:assert/strict";
import { db, closeDb } from "@/db";
import { queryCatalog, getFacets, getProduct } from "./query";
import { parseCatalogParams } from "./params";
import type { CatalogParams } from "./params";
import { storeConfig } from "../../../store.config";
async function main() {
  const all = await db.query.products.findMany({
    with: { brand: true, variants: true, notes: { with: { note: true } } },
  });
  assert.ok(all.length > 0, "Seed the database first");
  function expected(p: CatalogParams, scope = parseCatalogParams({})) {
    function productMatches(row: (typeof all)[number], f: CatalogParams) {
      return (
        row.isActive &&
        (!f.brand.length || f.brand.includes(row.brand.slug)) &&
        (!f.brandType.length || f.brandType.includes(row.brand.brandType)) &&
        (!f.gender.length || f.gender.includes(row.gender)) &&
        (!f.concentration.length ||
          f.concentration.includes(row.concentration)) &&
        (!f.packaging.length || f.packaging.includes(row.packaging)) &&
        (!f.family.length || f.family.includes(row.fragranceFamily ?? "")) &&
        (!f.note.length ||
          row.notes.some((n) => f.note.includes(n.note.slug))) &&
        (!f.q ||
          [row.name, row.brand.name, row.description, row.collectionName].some(
            (text) => text?.toLowerCase().includes(f.q.toLowerCase()),
          ))
      );
    }
    function variantMatches(
      v: (typeof all)[number]["variants"][number],
      f: CatalogParams,
    ) {
      return (
        v.isActive &&
        (f.minPrice === undefined || v.price >= f.minPrice) &&
        (f.maxPrice === undefined || v.price <= f.maxPrice) &&
        (!f.inStock || v.stockQuantity > 0) &&
        (!f.deal || v.price < v.retailPrice) &&
        (!f.size.length ||
          f.size.some((s) =>
            s === "under-50"
              ? v.sizeMl < 50
              : s === "50-99"
                ? v.sizeMl >= 50 && v.sizeMl < 100
                : v.sizeMl >= 100,
          ))
      );
    }
    return all
      .filter(
        (row) =>
          productMatches(row, p) &&
          productMatches(row, scope) &&
          row.variants.some(
            (v) => variantMatches(v, p) && variantMatches(v, scope),
          ),
      )
      .map((p) => p.id)
      .sort();
  }
  const cases = [
    {},
    { gender: "men", inStock: true },
    { concentration: ["oil", "attar"], deal: true },
    { size: ["100-plus"], maxPrice: 5000 },
    { minPrice: 3500, maxPrice: 5500, packaging: ["standard", "tester"] },
    { brand: all[0].brand.slug },
    { note: all[0].notes[0]?.note.slug },
    { family: all[0].fragranceFamily },
    { brandType: "niche", gender: "women" },
    { q: all[0].brand.name },
    { q: "%" },
    { q: "no-such-fragrance" },
    { minPrice: 9999, maxPrice: 1 },
  ];
  // Totals must always match; full ID lists only when every match fits on one page.
  const sameListing = (items: { id: string }[], total: number, want: string[], label: string) => {
    assert.equal(total, want.length, label);
    const got = items.map((p) => p.id).sort();
    if (want.length <= 100) assert.deepEqual(got, want, label);
    else assert.ok(got.every((id) => new Set(want).has(id)), label);
  };
  for (const raw of cases) {
    const result = await queryCatalog(raw, { limit: 100 });
    sameListing(result.items, result.total, expected(parseCatalogParams(raw)), JSON.stringify(raw));
  }
  const scope = { gender: ["men"], minPrice: 4000, size: ["100-plus"] };
  const refinement = { maxPrice: 6000, inStock: true };
  const scoped = await queryCatalog(refinement, { scope, limit: 100 });
  sameListing(scoped.items, scoped.total, expected(parseCatalogParams(refinement), parseCatalogParams(scope)), "scoped");
  const conflicting = await queryCatalog(
    { gender: "women" },
    { scope: { gender: ["men"] } },
  );
  assert.equal(conflicting.total, 0);
  const first = await queryCatalog(),
    second = await queryCatalog({ page: 2 });
  assert.equal(
    first.items.length,
    Math.min(storeConfig.catalog.pageSize, first.total),
  );
  assert.ok(!first.items.some((p) => second.items.some((q) => q.id === p.id)));
  const priceAsc = await queryCatalog(
    { sort: "price-asc", inStock: true },
    { limit: 100 },
  );
  // Compare SQL ordering to minimum qualifying price, independent of which default SKU is displayed.
  const minimums = priceAsc.items.map((p) =>
    Math.min(
      ...all
        .find((r) => r.id === p.id)!
        .variants.filter((v) => v.isActive && v.stockQuantity > 0)
        .map((v) => v.price),
    ),
  );
  assert.deepEqual(
    minimums,
    [...minimums].sort((a, b) => a - b),
  );
  const facets = await getFacets({ gender: "men", deal: "true" });
  for (const facet of facets.brand)
    assert.equal(
      facet.count,
      expected(
        parseCatalogParams({ gender: "men", deal: true, brand: facet.value }),
      ).length,
    );
  // Every facet count must equal the listing total after picking that value
  // (counts ignore the facet's own selection, so start from a cleared group).
  for (const base of [{}, { gender: "women", inStock: "true" }, { note: "oud", size: "100-plus" }]) {
    const facetsFor = await getFacets(base);
    for (const [group, options] of Object.entries(facetsFor)) {
      for (const option of options) {
        const picked = await queryCatalog({ ...base, [group]: option.value, page: "1" });
        assert.equal(option.count, picked.total, `${JSON.stringify(base)} ${group}=${option.value}`);
      }
    }
  }
  const product = await getProduct(all[0].slug);
  assert.ok(product);
  assert.ok(!("costPrice" in product.variants[0]));
  const related = await queryCatalog(
    {},
    {
      excludeId: product.id,
      limit: 8,
      related: {
        brandId: product.brandId,
        noteIds: product.notes.map((n) => n.noteId),
      },
    },
  );
  assert.ok(!related.items.some((p) => p.id === product.id));
  assert.equal(await getProduct("not-a-real-product"), undefined);
  console.log(
    `Catalog verification passed: ${cases.length} filter/search cases, scope intersections, pagination, sorting, facets, public variant fields, related products and 404 lookup.`,
  );
}
main()
  .finally(closeDb)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
