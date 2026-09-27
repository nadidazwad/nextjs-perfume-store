import { asc, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { brands, products, productVariants, productImages } from "@/db/schema";
import { cartSchema, type CartQuote } from "./schema";

export const emptyQuote = (): CartQuote => ({
  items: [],
  messages: [],
  subtotal: 0,
  discount: 0,
  coupon: null,
  couponError: "",
});
export async function quoteCart(
  input: unknown,
  executor: DbExecutor = db,
): Promise<CartQuote> {
  const lines = cartSchema.parse(input);
  if (!lines.length) return emptyQuote();
  const rows = await executor
    .select({ variant: productVariants, product: products, brand: brands.name })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(
      inArray(
        productVariants.id,
        lines.map((line) => line.variantId),
      ),
    );
  const images = rows.length
    ? await executor
        .select()
        .from(productImages)
        .where(
          inArray(
            productImages.productId,
            rows.map((row) => row.product.id),
          ),
        )
        .orderBy(asc(productImages.sortOrder), asc(productImages.id))
    : [];
  const quote = emptyQuote();
  for (const line of lines) {
    const row = rows.find((row) => row.variant.id === line.variantId);
    if (
      !row ||
      !row.variant.isActive ||
      !row.product.isActive ||
      row.variant.stockQuantity < 1
    ) {
      quote.messages.push(
        `${row?.product.name ?? "An item"} is no longer available and was removed from your bag.`,
      );
      continue;
    }
    const { variant: v, product: p } = row;
    const qty = Math.min(line.qty, v.stockQuantity);
    if (qty !== line.qty)
      quote.messages.push(
        `${p.name}: quantity reduced to ${qty} to match current stock.`,
      );
    if (line.price !== undefined && line.price !== v.price)
      quote.messages.push(
        `${p.name}: the price has changed. Review the updated total.`,
      );
    quote.items.push({
      variantId: v.id,
      qty,
      price: v.price,
      name: p.name,
      brand: row.brand,
      slug: p.slug,
      label: v.sizeLabel ?? `${v.sizeMl} ml`,
      image: images.find((image) => image.productId === p.id)?.url ?? null,
      stock: v.stockQuantity,
    });
    quote.subtotal += v.price * qty;
  }
  if (!Number.isSafeInteger(quote.subtotal) || quote.subtotal > 2_000_000_000)
    throw new Error("Bag total exceeds the order limit.");
  return quote;
}
