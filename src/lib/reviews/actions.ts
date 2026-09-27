"use server";
import { demoWriteRefused } from "@/lib/demo/session";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { clientIp, takeRateLimit } from "@/lib/rate-limit";
import { storeConfig } from "../../../store.config";
import { reviewInputSchema } from "./schema";
import { hasDeliveredPurchase } from "./server";

export type ReviewResult =
  | { ok: true; verified: boolean }
  | { ok: false; message: string; fields?: Record<string, string[] | undefined> };

/** Guest review submission. Lands as `pending`; nothing is public until approved. */
export async function submitReview(input: unknown): Promise<ReviewResult> {
  if (!storeConfig.features.reviews) return { ok: false, message: "Reviews aren't available." };
  if (await demoWriteRefused(await headers()))
    return { ok: false, message: "This is a demo store. Start your own demo store (Try the admin, at the top) to write reviews." };
  if (!(await takeRateLimit("review-ip", clientIp(await headers()), 5)))
    return { ok: false, message: "You've sent several reviews recently. Please try again later." };
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Check the highlighted fields.", fields: parsed.error.flatten().fieldErrors };
  const data = parsed.data;
  // Bots fill every field. Pretend success so they don't retry.
  if (data.website) return { ok: true, verified: false };
  try {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, data.productId), eq(products.isActive, true)));
    if (!product) return { ok: false, message: "This product is no longer available." };
    const verified = await hasDeliveredPurchase(data.phone, product.id);
    await db.insert(reviews).values({
      productId: product.id,
      customerName: data.name,
      customerPhone: data.phone,
      rating: data.rating,
      title: data.title,
      body: data.body,
      status: "pending",
      verifiedPurchase: verified,
    });
    return { ok: true, verified };
  } catch {
    return { ok: false, message: "We couldn't save your review. Please try again." };
  }
}
