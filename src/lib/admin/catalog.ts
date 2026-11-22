import { asc, count, countDistinct, eq, inArray, min } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import {
  products,
  productVariants,
  productImages,
  productNotes,
  orderItems,
  orders,
  reviews,
  type OrderStatus,
} from "@/db/schema";
import { ORDER_TRANSITIONS, canTransition } from "@/lib/orders/transitions";
import { productSchema, type ActionResult } from "./schema";
import { storeConfig } from "../../../store.config";

type OrderGroup = { count: number; example: string | null };
/**
 * Orders containing any of these variants, grouped by what they still need:
 * - open: can still change status, so may still take or restore stock;
 * - cancellable: can still be cancelled (a test order, say);
 * - kept: shipped, delivered or returned, which stay as sales history.
 * Order lines keep their own copy of the product, so cancelled orders need nothing.
 */
async function orderUsage(executor: DbExecutor, variantIds: string[]) {
  const rows = variantIds.length
    ? await executor
        .select({
          status: orders.status,
          count: countDistinct(orders.id),
          example: min(orders.orderNumber),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(inArray(orderItems.variantId, variantIds))
        .groupBy(orders.status)
    : [];
  const group = (match: (status: OrderStatus) => boolean): OrderGroup => {
    const matched = rows.filter((row) => match(row.status));
    return {
      count: matched.reduce((sum, row) => sum + Number(row.count), 0),
      example: matched.map((row) => row.example).filter((n) => n !== null).sort()[0] ?? null,
    };
  };
  const cancellable = (status: OrderStatus) => canTransition(status, "cancelled");
  return {
    open: group((status) => ORDER_TRANSITIONS[status].length > 0),
    cancellable: group(cancellable),
    kept: group((status) => status !== "cancelled" && !cancellable(status)),
  };
}

const orderCount = (n: number) => (n === 1 ? "order" : `${n} orders`);
/** Why this product can't be deleted, or null when it can. Sales history first: cancelling can't clear it. */
function deletionBlocker({ cancellable, kept }: Awaited<ReturnType<typeof orderUsage>>) {
  if (kept.count)
    return kept.count === 1
      ? `It was sold in order ${kept.example}, so it stays for your sales records.`
      : `It was sold in ${orderCount(kept.count)}, so it stays for your sales records.`;
  if (cancellable.count)
    return cancellable.count === 1
      ? `Order ${cancellable.example} is still open. If it was a test order, cancel it, then delete the product.`
      : `It's in ${orderCount(cancellable.count)} that are still open, such as ${cancellable.example}. If they were test orders, cancel them, then delete the product.`;
  return null;
}

/**
 * What deleting a product would remove, or why it's blocked. A product can be
 * deleted only if every order that contains it was cancelled: open orders
 * still need its stock, and sold ones are history. Hiding works for those.
 */
export async function productRemoval(productId: string, executor: DbExecutor = db) {
  const variants = await executor
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const [reviewRows] = storeConfig.features.reviews
    ? await executor.select({ count: count() }).from(reviews).where(eq(reviews.productId, productId))
    : [];
  return {
    sizes: variants.length,
    /** Deleted with the product; 0 while reviews are switched off. */
    reviews: Number(reviewRows?.count ?? 0),
    blocked: deletionBlocker(await orderUsage(executor, variants.map((v) => v.id))),
  };
}
export type ProductRemoval = Awaited<ReturnType<typeof productRemoval>>;

/** Authenticated callers only. Sizes, images, notes and reviews go with it. */
export async function deleteProductRecord(productId: string): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");
    if (!product) return { ok: false, message: "Product not found. It may already be deleted." };
    // Checkout locks these rows before it adds order lines, so an order placed
    // meanwhile either shows up in the check below or finds the product gone.
    await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.id))
      .for("update");
    const { blocked } = await productRemoval(productId, tx);
    if (blocked) return { ok: false, message: `${blocked} To take it off the store, hide it instead.` };
    await tx.delete(products).where(eq(products.id, productId));
    return { ok: true, message: `${product.name} deleted.` };
  });
}
/** Authenticated callers only. Atomic edits preserve ordered variant IDs and detect stock drift. */
export async function saveProductRecord(
  id: string | undefined,
  input: unknown,
) {
  const { variants, images, notes, ...values } = productSchema.parse(input);
  return db.transaction(async (tx) => {
    const existing = id
      ? (
          await tx
            .select()
            .from(products)
            .where(eq(products.id, id))
            .for("update")
        )[0]
      : undefined;
    if (id && !existing) throw new Error("Product not found.");
    const [product] = existing
      ? await tx
          .update(products)
          .set(values)
          .where(eq(products.id, existing.id))
          .returning()
      : await tx.insert(products).values(values).returning();
    const old = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(productVariants.id)
      .for("update");
    for (const v of variants) {
      if (!v.id) continue;
      const previous = old.find((o) => o.id === v.id);
      if (!previous)
        throw new Error("A variant does not belong to this product.");
      if (
        v.expectedStock === undefined ||
        previous.stockQuantity !== v.expectedStock
      )
        throw new Error(
          "Stock changed while you were editing. Reload before saving.",
        );
    }
    const removed = old.filter((o) => !variants.some((v) => v.id === o.id));
    if (removed.length) {
      const usage = await orderUsage(
        tx,
        removed.map((v) => v.id),
      );
      if (usage.open.count)
        throw new Error(
          "A removed variant belongs to an open order. Keep it until the order is closed.",
        );
      await tx.delete(productVariants).where(
        inArray(
          productVariants.id,
          removed.map((v) => v.id),
        ),
      );
    }
    await tx
      .update(productVariants)
      .set({ isDefault: false })
      .where(eq(productVariants.productId, product.id));
    for (const variant of variants) {
      const { id: variantId, expectedStock: _expectedStock, ...v } = variant;
      void _expectedStock;
      if (variantId)
        await tx
          .update(productVariants)
          .set(v)
          .where(eq(productVariants.id, variantId));
      else
        await tx
          .insert(productVariants)
          .values({ ...v, productId: product.id });
    }
    await tx
      .delete(productImages)
      .where(eq(productImages.productId, product.id));
    if (images.length)
      await tx
        .insert(productImages)
        .values(
          images.map((v, sortOrder) => ({
            ...v,
            sortOrder,
            productId: product.id,
          })),
        );
    await tx.delete(productNotes).where(eq(productNotes.productId, product.id));
    if (notes.length)
      await tx
        .insert(productNotes)
        .values(notes.map((v) => ({ ...v, productId: product.id })));
    return product.id;
  });
}
