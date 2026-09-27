import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  productVariants,
  productImages,
  productNotes,
  orderItems,
  orders,
} from "@/db/schema";
import { productSchema } from "./schema";
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
      const open = await tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            inArray(
              orderItems.variantId,
              removed.map((v) => v.id),
            ),
            inArray(orders.status, [
              "pending",
              "confirmed",
              "packed",
              "shipped",
            ]),
          ),
        );
      if (open.length)
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
