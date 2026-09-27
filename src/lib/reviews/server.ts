import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { orderItems, orders, productVariants, reviews } from "@/db/schema";
import { storeConfig } from "../../../store.config";
import { summarizeRatings } from "./schema";

export const REVIEWS_PAGE_SIZE = 6;

/**
 * A review is a verified purchase when its phone number placed an order that
 * was delivered and contained any size of this product.
 */
export async function hasDeliveredPurchase(
  phone: string | null | undefined,
  productId: string,
  executor: DbExecutor = db,
) {
  if (!phone) return false;
  const rows = await executor
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        eq(orders.customerPhone, phone),
        eq(orders.status, "delivered"),
        eq(productVariants.productId, productId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Approved reviews + summary for a product page. Never runs when reviews are off. */
export async function getProductReviews(productId: string, page = 1) {
  if (!storeConfig.features.reviews) return null;
  const approved = and(eq(reviews.productId, productId), eq(reviews.status, "approved"));
  const [grouped, pageRows] = await Promise.all([
    db
      .select({ rating: reviews.rating, count: count() })
      .from(reviews)
      .where(approved)
      .groupBy(reviews.rating),
    db
      .select({
        id: reviews.id,
        name: reviews.customerName,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        verified: reviews.verifiedPurchase,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(approved)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(REVIEWS_PAGE_SIZE * Math.max(1, Math.min(page, 50))),
  ]);
  const summary = summarizeRatings(Object.fromEntries(grouped.map((g) => [g.rating, g.count])));
  return { summary, reviews: pageRows, hasMore: pageRows.length < summary.count };
}

/** Approved-review aggregates for product cards, keyed by product id. */
export async function getRatingsFor(productIds: string[]) {
  const ratings = new Map<string, { average: number; count: number }>();
  if (!storeConfig.features.reviews || !productIds.length) return ratings;
  const rows = await db
    .select({
      productId: reviews.productId,
      average: sql<number>`round(avg(${reviews.rating})::numeric, 1)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(inArray(reviews.productId, productIds), eq(reviews.status, "approved")))
    .groupBy(reviews.productId);
  for (const row of rows) ratings.set(row.productId, { average: Number(row.average), count: row.count });
  return ratings;
}
