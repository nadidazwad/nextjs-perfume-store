import Link from "next/link";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, brands, productImages, productVariants } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { ProductList } from "@/components/admin/product-list";
import { PageHeader, Pagination } from "@/components/admin/ui";
import { Plus, Search, X } from "lucide-react";
import { storeConfig } from "../../../../../store.config";
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const p = await searchParams;
  const page = Math.max(1, Math.min(100000, Number(p.page) || 1));
  const q = (p.q ?? "").slice(0, 160);
  const stock = sql`coalesce((select sum(${productVariants.stockQuantity}) from ${productVariants} where ${productVariants.productId}=${products.id} and ${productVariants.isActive}=true),0)`;
  const where = and(
    q ? ilike(products.name, `%${q}%`) : undefined,
    p.brand ? eq(products.brandId, p.brand) : undefined,
    p.status === "active"
      ? eq(products.isActive, true)
      : p.status === "inactive"
        ? eq(products.isActive, false)
        : undefined,
    p.stock === "low"
      ? sql`${stock} <= ${storeConfig.catalog.lowStockThreshold}`
      : p.stock === "out"
        ? sql`${stock}=0`
        : undefined,
  );
  const [rows, b, [total]] = await Promise.all([
    db.query.products.findMany({
      where,
      with: {
        brand: true,
        variants: true,
        images: { orderBy: asc(productImages.sortOrder), limit: 1 },
      },
      orderBy: desc(products.createdAt),
      limit: 25,
      offset: (page - 1) * 25,
    }),
    db.select().from(brands).orderBy(asc(brands.name)),
    db.select({ count: count() }).from(products).where(where),
  ]);
  const href = (n: number) =>
    `/admin/products?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => Boolean(e[1]))), page: String(n) })}`;
  const filtered = Boolean(q || p.brand || p.status || p.stock);
  return (
    <>
      <PageHeader
        title="Products"
        description={`${total.count} ${total.count === 1 ? "product" : "products"} ${filtered ? "match these filters" : "in your catalog"}`}
        actions={
          <Link className="admin-btn primary" href="/admin/products/new">
            <Plus size={16} /> New product
          </Link>
        }
      />
      <form className="admin-filters">
        <label className="admin-search-field">
          <Search size={16} aria-hidden />
          <input
            name="q"
            type="search"
            aria-label="Search products"
            placeholder="Search by product name"
            defaultValue={q}
          />
        </label>
        <select name="brand" aria-label="Brand" defaultValue={p.brand ?? ""}>
          <option value="">All brands</option>
          {b.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select name="status" aria-label="Visibility" defaultValue={p.status ?? ""}>
          <option value="">Any visibility</option>
          <option value="active">Visible</option>
          <option value="inactive">Hidden</option>
        </select>
        <select name="stock" aria-label="Stock" defaultValue={p.stock ?? ""}>
          <option value="">Any stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <button className="admin-btn dark">Apply</button>
        {filtered && (
          <Link className="admin-btn ghost" href="/admin/products">
            <X size={14} /> Clear
          </Link>
        )}
      </form>
      <ProductList
        key={JSON.stringify(p)}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          brand: r.brand.name,
          concentration: r.concentration,
          isActive: r.isActive,
          isFeatured: r.isFeatured,
          image: r.images[0]?.url ?? null,
          variants: r.variants.length,
          min:
            Math.min(...r.variants.map((v) => v.price), Infinity) === Infinity
              ? 0
              : Math.min(...r.variants.map((v) => v.price)),
          max: Math.max(0, ...r.variants.map((v) => v.price)),
          stock: r.variants
            .filter((v) => v.isActive)
            .reduce((sum, v) => sum + v.stockQuantity, 0),
        }))}
      />
      <Pagination
        page={page}
        pageSize={25}
        total={total.count}
        noun="products"
        href={href}
      />
    </>
  );
}
