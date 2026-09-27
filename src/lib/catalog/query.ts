import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  brands,
  products,
  productVariants as variants,
  productImages,
  productNotes,
  notes,
} from "@/db/schema";
import { storeConfig } from "../../../store.config";
import { parseCatalogParams, type CatalogParams } from "./params";
import { getRatingsFor } from "@/lib/reviews/server";

export type PublicVariant = Pick<
  typeof variants.$inferSelect,
  | "id"
  | "sku"
  | "sizeMl"
  | "sizeLabel"
  | "price"
  | "retailPrice"
  | "stockQuantity"
  | "lowStockOverride"
  | "barcode"
  | "isDefault"
>;
export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  brand: { name: string; slug: string };
  concentration: string;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
  variant: PublicVariant;
  hasStock: boolean;
  /** Approved-review aggregate; absent when reviews are off or none exist. */
  rating?: { average: number; count: number };
};
const publicVariantColumns = {
  id: true,
  sku: true,
  sizeMl: true,
  sizeLabel: true,
  price: true,
  retailPrice: true,
  stockQuantity: true,
  lowStockOverride: true,
  barcode: true,
  isDefault: true,
} as const;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
function variantWhere(p: CatalogParams): SQL {
  const conditions: SQL[] = [eq(variants.isActive, true)];
  if (p.minPrice !== undefined)
    conditions.push(gte(variants.price, p.minPrice));
  if (p.maxPrice !== undefined)
    conditions.push(lte(variants.price, p.maxPrice));
  if (p.inStock) conditions.push(sql`${variants.stockQuantity} > 0`);
  if (p.deal) conditions.push(sql`${variants.price} < ${variants.retailPrice}`);
  if (p.size.length)
    conditions.push(
      or(
        ...p.size.map((size) =>
          size === "under-50"
            ? sql`${variants.sizeMl} < 50`
            : size === "50-99"
              ? sql`${variants.sizeMl} between 50 and 99`
              : sql`${variants.sizeMl} >= 100`,
        ),
      )!,
    );
  return and(...conditions)!;
}
/** Product AND variant predicates compose once. Variant constraints must match the same variant. */
export function catalogWhere(p: CatalogParams): SQL {
  const conditions: SQL[] = [
    eq(products.isActive, true),
    exists(
      db
        .select({ id: variants.id })
        .from(variants)
        .where(and(eq(variants.productId, products.id), variantWhere(p))),
    ),
  ];
  if (p.brand.length) conditions.push(inArray(brands.slug, p.brand));
  if (p.brandType.length)
    conditions.push(inArray(brands.brandType, p.brandType));
  if (p.gender.length) conditions.push(inArray(products.gender, p.gender));
  if (p.concentration.length)
    conditions.push(inArray(products.concentration, p.concentration));
  if (p.packaging.length)
    conditions.push(inArray(products.packaging, p.packaging));
  if (p.family.length)
    conditions.push(inArray(products.fragranceFamily, p.family));
  if (p.note.length)
    conditions.push(
      exists(
        db
          .select({ id: productNotes.noteId })
          .from(productNotes)
          .innerJoin(notes, eq(notes.id, productNotes.noteId))
          .where(
            and(
              eq(productNotes.productId, products.id),
              inArray(notes.slug, p.note),
            ),
          ),
      ),
    );
  if (p.new)
    conditions.push(
      gte(
        products.createdAt,
        new Date(Date.now() - storeConfig.catalog.newArrivalDays * 86400000),
      ),
    );
  if (p.q) {
    const term = `%${escapeLike(p.q)}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(brands.name, term),
        ilike(products.description, term),
        ilike(products.collectionName, term),
      )!,
    );
  }
  return and(...conditions)!;
}
export async function queryCatalog(
  raw: Record<string, unknown> = {},
  options: {
    scope?: Record<string, unknown>;
    limit?: number;
    featured?: boolean;
    excludeId?: string;
    related?: { brandId: string; noteIds: string[] };
  } = {},
) {
  const params = parseCatalogParams(raw);
  const scope = parseCatalogParams(options.scope);
  const filters: SQL[] = [catalogWhere(params), catalogWhere(scope)];
  if (options.featured) filters.push(eq(products.isFeatured, true));
  if (options.excludeId)
    filters.push(sql`${products.id} <> ${options.excludeId}`);
  if (options.related)
    filters.push(
      or(
        eq(products.brandId, options.related.brandId),
        exists(
          db
            .select({ id: productNotes.noteId })
            .from(productNotes)
            .where(
              and(
                eq(productNotes.productId, products.id),
                options.related.noteIds.length
                  ? inArray(productNotes.noteId, options.related.noteIds)
                  : sql`false`,
              ),
            ),
        ),
      )!,
    );
  const where = and(...filters)!;
  const price = sql<number>`(select min(${variants.price}) from ${variants} where ${variants.productId} = ${products.id} and ${variantWhere(params)} and ${variantWhere(scope)})`;
  const discount = sql<number>`(select max((${variants.retailPrice} - ${variants.price})::numeric / nullif(${variants.retailPrice}, 0)) from ${variants} where ${variants.productId} = ${products.id} and ${variantWhere(params)} and ${variantWhere(scope)})`;
  const sort = raw.sort ? params.sort : scope.sort;
  const order: SQL[] = [];
  if (params.q)
    order.push(
      sql`case when ${brands.name} ilike ${`%${escapeLike(params.q)}%`} then 0 when ${products.name} ilike ${`%${escapeLike(params.q)}%`} then 1 else 2 end`,
    );
  order.push(
    sort === "price-asc"
      ? asc(price)
      : sort === "price-desc"
        ? desc(price)
        : sort === "discount"
          ? sql`${discount} desc nulls last`
          : sort === "name"
            ? asc(products.name)
            : desc(products.createdAt),
    asc(products.id),
  );
  // This extra EXISTS makes collection and shopper variant constraints intersect on one SKU.
  const combinedWhere = and(
    where,
    exists(
      db
        .select({ id: variants.id })
        .from(variants)
        .where(
          and(
            eq(variants.productId, products.id),
            variantWhere(params),
            variantWhere(scope),
          ),
        ),
    ),
  )!;
  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(combinedWhere);
  const pageSize = options.limit ?? storeConfig.catalog.pageSize;
  const pages = Math.max(1, Math.ceil(count.total / pageSize));
  const page = Math.min(params.page, pages);
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(combinedWhere)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const cards = rows.length
    ? await db.query.products.findMany({
        where: inArray(
          products.id,
          rows.map((r) => r.id),
        ),
        with: {
          brand: { columns: { name: true, slug: true } },
          images: {
            columns: { url: true, alt: true },
            orderBy: [asc(productImages.sortOrder)],
            limit: 2,
          },
          variants: {
            columns: publicVariantColumns,
            where: and(variantWhere(params), variantWhere(scope)),
            orderBy: [desc(variants.isDefault), asc(variants.price)],
          },
        },
      })
    : [];
  const mapped = new Map<string, ProductCardData>(
    cards.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        concentration: p.concentration,
        image: p.images[0] ?? null,
        hoverImage: p.images[1] ?? null,
        variant:
          sort === "price-asc" || sort === "price-desc"
            ? [...p.variants].sort((a, b) => a.price - b.price)[0]
            : sort === "discount"
              ? [...p.variants].sort(
                  (a, b) =>
                    (b.retailPrice - b.price) / (b.retailPrice || 1) -
                    (a.retailPrice - a.price) / (a.retailPrice || 1),
                )[0]
              : (p.variants.find((v) => v.stockQuantity > 0) ?? p.variants[0]),
        hasStock: p.variants.some((v) => v.stockQuantity > 0),
      } satisfies ProductCardData,
    ]),
  );
  const ratings = await getRatingsFor(rows.map((r) => r.id));
  for (const [id, rating] of ratings) {
    const card = mapped.get(id);
    if (card) card.rating = rating;
  }
  return {
    items: rows.map((r) => mapped.get(r.id)!),
    total: count.total,
    pages,
    page,
    params,
  };
}
/** Cards for an explicit id list (wishlist, recently viewed), in the given order. Inactive products drop out. */
export async function getCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  const unique = [...new Set(ids)].slice(0, 60);
  if (!unique.length) return [];
  const rows = await db.query.products.findMany({
    where: and(inArray(products.id, unique), eq(products.isActive, true)),
    with: {
      brand: { columns: { name: true, slug: true } },
      images: {
        columns: { url: true, alt: true },
        orderBy: [asc(productImages.sortOrder)],
        limit: 2,
      },
      variants: {
        columns: publicVariantColumns,
        where: eq(variants.isActive, true),
        orderBy: [desc(variants.isDefault), asc(variants.price)],
      },
    },
  });
  const ratings = await getRatingsFor(rows.map((r) => r.id));
  const cards = new Map(
    rows
      .filter((p) => p.variants.length)
      .map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          concentration: p.concentration,
          image: p.images[0] ?? null,
          hoverImage: p.images[1] ?? null,
          variant: p.variants.find((v) => v.stockQuantity > 0) ?? p.variants[0],
          hasStock: p.variants.some((v) => v.stockQuantity > 0),
          ...(ratings.has(p.id) ? { rating: ratings.get(p.id) } : {}),
        } satisfies ProductCardData,
      ]),
  );
  return unique.flatMap((id) => cards.get(id) ?? []);
}

/** Header autosuggest: top products (via the shared catalog query) plus matching brands. */
export async function searchSuggestions(q: string) {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return { products: [], brands: [], total: 0 };
  const [catalog, brandRows] = await Promise.all([
    queryCatalog({ q: term }, { limit: 5 }),
    db
      .select({ name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl })
      .from(brands)
      .where(ilike(brands.name, `%${escapeLike(term)}%`))
      .orderBy(
        sql`case when ${brands.name} ilike ${`${escapeLike(term)}%`} then 0 else 1 end`,
        asc(brands.name),
      )
      .limit(4),
  ]);
  return {
    products: catalog.items.map((p) => ({
      name: p.name,
      slug: p.slug,
      brand: p.brand.name,
      image: p.image?.url ?? null,
      price: p.variant.price,
      retailPrice: p.variant.retailPrice,
      size: p.variant.sizeLabel ?? `${p.variant.sizeMl} ml`,
      hasStock: p.hasStock,
    })),
    brands: brandRows,
    total: catalog.total,
  };
}
export type Suggestions = Awaited<ReturnType<typeof searchSuggestions>>;

export const getProduct = cache(async (slug: string) =>
  db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      brand: true,
      images: { orderBy: [asc(productImages.sortOrder)] },
      variants: {
        columns: publicVariantColumns,
        where: eq(variants.isActive, true),
        orderBy: [desc(variants.isDefault), asc(variants.sizeMl)],
      },
      notes: { with: { note: true } },
    },
  }),
);
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** Counts reflect all current constraints except the facet's own selection. */
export async function getFacets(
  raw: Record<string, unknown>,
  scopeRaw: Record<string, unknown> = {},
) {
  const p = parseCatalogParams(raw),
    scope = parseCatalogParams(scopeRaw);
  const groups = [
    "brand",
    "brandType",
    "gender",
    "concentration",
    "packaging",
    "family",
    "note",
    "size",
  ] as const;
  type Facet = { value: string; label: string; count: number; group?: string };
  // Independent queries: run them together instead of one round trip after another.
  const counts = await Promise.all(groups.map(async (key): Promise<Facet[]> => {
    const own = { ...p, [key]: [] };
    const matched = db
      .select({ id: products.id })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(
        and(
          catalogWhere(own),
          catalogWhere(scope),
          exists(
            db
              .select({ id: variants.id })
              .from(variants)
              .where(
                and(
                  eq(variants.productId, products.id),
                  variantWhere(own),
                  variantWhere(scope),
                ),
              ),
          ),
        ),
      );
    // count(distinct) always sorts; de-duplicating first lets Postgres hash instead.
    if (key === "note") {
      const pairs = db
        .selectDistinct({ noteId: productNotes.noteId, productId: productNotes.productId })
        .from(productNotes)
        .where(inArray(productNotes.productId, matched))
        .as("note_pairs");
      return db
        .select({
          value: notes.slug,
          label: notes.name,
          group: notes.group,
          count: sql<number>`count(*)::int`,
        })
        .from(pairs)
        .innerJoin(notes, eq(notes.id, pairs.noteId))
        .groupBy(notes.id)
        .orderBy(asc(notes.group), asc(notes.name));
    }
    if (key === "size") {
      const bucket = sql<string>`case when ${variants.sizeMl} < 50 then 'under-50' when ${variants.sizeMl} < 100 then '50-99' else '100-plus' end`;
      const sized = db
        .selectDistinct({ productId: variants.productId, bucket: bucket.as("bucket") })
        .from(variants)
        .where(
          and(
            inArray(variants.productId, matched),
            variantWhere(own),
            variantWhere(scope),
          ),
        )
        .as("sized");
      return db
        .select({
          value: sized.bucket,
          label: sized.bucket,
          count: sql<number>`count(*)::int`,
        })
        .from(sized)
        .groupBy(sized.bucket);
    }
    {
      const value =
        key === "brand"
          ? brands.slug
          : key === "brandType"
            ? brands.brandType
            : key === "family"
              ? products.fragranceFamily
              : products[key];
      const name = key === "brand" ? brands.name : value;
      const rows = await db
        .select({
          value,
          label: name,
          // One row per product (products → brands is many-to-one), so no distinct needed.
          count: sql<number>`count(*)::int`,
        })
        .from(products)
        .innerJoin(brands, eq(brands.id, products.brandId))
        .where(inArray(products.id, matched))
        .groupBy(value, name)
        .orderBy(asc(name));
      return rows.filter(
        (r): r is { value: string; label: string; count: number } =>
          r.value !== null && r.label !== null,
      );
    }
  }));
  return Object.fromEntries(groups.map((key, i) => [key, counts[i]])) as Record<string, Facet[]>;
}
