import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { brands, productImages, products, reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { LinkTabs, PageHeader, Pagination } from "@/components/admin/ui";
import { ReviewQueue } from "@/components/admin/review-queue";
import { formatDateTime } from "@/lib/admin/format";
import { summarizeRatings } from "@/lib/reviews/schema";
import { storeConfig } from "../../../../../store.config";

export const metadata = { title: "Reviews" };
const PAGE_SIZE = 20;
const tabs = [
  ["pending", "Pending"],
  ["approved", "Published"],
  ["rejected", "Rejected"],
  ["all", "All"],
] as const;
type Tab = (typeof tabs)[number][0];

export default async function Reviews({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  if (!storeConfig.features.reviews) notFound();
  const p = await searchParams;
  const status: Tab = tabs.some(([t]) => t === p.status) ? (p.status as Tab) : "pending";
  const q = (p.q ?? "").trim().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = and(
    status === "all" ? undefined : eq(reviews.status, status),
    q ? or(ilike(reviews.customerName, term), ilike(reviews.body, term), ilike(reviews.title, term), ilike(products.name, term)) : undefined,
  );
  const [rows, [total], statusCounts, ratingCounts] = await Promise.all([
    db
      .select({ review: reviews, product: { id: products.id, name: products.name, slug: products.slug }, brand: brands.name })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .innerJoin(brands, eq(brands.id, products.brandId))
      .where(where)
      // The queue works oldest-first; history reads newest-first.
      .orderBy(status === "pending" ? asc(reviews.createdAt) : desc(reviews.createdAt), asc(reviews.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).where(where),
    db.select({ status: reviews.status, count: count() }).from(reviews).groupBy(reviews.status),
    db.select({ rating: reviews.rating, count: count() }).from(reviews).where(eq(reviews.status, "approved")).groupBy(reviews.rating),
  ]);
  const images = rows.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url, sortOrder: productImages.sortOrder })
        .from(productImages)
        .where(inArray(productImages.productId, [...new Set(rows.map((r) => r.product.id))]))
        .orderBy(asc(productImages.sortOrder))
    : [];
  const countFor = (s: Tab) =>
    s === "all" ? statusCounts.reduce((sum, r) => sum + r.count, 0) : (statusCounts.find((r) => r.status === s)?.count ?? 0);
  const published = summarizeRatings(Object.fromEntries(ratingCounts.map((r) => [r.rating, r.count])));
  const href = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(
      Object.entries({ status, q: q || undefined, ...next }).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "").map(([k, v]) => [k, String(v)]),
    );
    return `/admin/reviews${params.size ? `?${params}` : ""}`;
  };
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Nothing appears on the store until you approve it. Verified means the phone number has a delivered order for that product."
      />
      <div className="admin-kpis compact">
        {[
          ["Waiting for you", countFor("pending"), countFor("pending") > 0 ? "warn" : undefined],
          ["Published", countFor("approved")],
          ["Average rating", published.count ? `${published.average.toFixed(1)} ★` : "—"],
          ["Rejected", countFor("rejected")],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="admin-kpi static" data-tone={tone}>
            <span className="admin-kpi-label">{label}</span>
            <strong className="admin-kpi-value">{value}</strong>
          </div>
        ))}
      </div>
      <LinkTabs
        label="Review status"
        tabs={tabs.map(([value, label]) => ({
          href: href({ status: value, page: undefined }),
          label,
          count: countFor(value),
          current: status === value,
        }))}
      />
      <form className="admin-filters">
        <input type="hidden" name="status" value={status} />
        <label className="admin-search-field">
          <Search size={16} aria-hidden />
          <input name="q" type="search" aria-label="Search reviews" placeholder="Reviewer, product or words in the review" defaultValue={q} />
        </label>
        <button className="admin-btn dark">Search</button>
        {q && (
          <Link className="admin-btn ghost" href={href({ q: undefined, page: undefined })}>
            <X size={14} /> Clear
          </Link>
        )}
      </form>
      <ReviewQueue
        key={JSON.stringify([status, q, page, rows.map((r) => [r.review.id, r.review.status])])}
        empty={q ? `No reviews match “${q}”` : status === "pending" ? "You're all caught up" : `No ${tabs.find(([t]) => t === status)![1].toLowerCase()} reviews`}
        rows={rows.map(({ review: r, product, brand }) => ({
          id: r.id,
          status: r.status,
          rating: r.rating,
          title: r.title,
          body: r.body,
          name: r.customerName,
          phone: r.customerPhone,
          verified: r.verifiedPurchase,
          created: formatDateTime(r.createdAt),
          product: { ...product, brand, image: images.find((i) => i.productId === product.id)?.url ?? null },
        }))}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total.count} noun="reviews" href={(n) => href({ page: n })} />
    </>
  );
}
