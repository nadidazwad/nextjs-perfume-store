import { eq, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  orders,
  orderItems,
  orderEvents,
  productVariants,
} from "@/db/schema";
import { quoteCart } from "@/lib/cart/quote";
import { nextOrderNumber } from "@/lib/order-number";
import { checkCoupon, redeemCoupon } from "@/lib/coupons/server";
import type { AppliedCoupon } from "@/lib/coupons/rules";
import { storeConfig } from "../../../store.config";
import { checkoutSchema, deliveryTotals } from "./schema";

export class CheckoutError extends Error {}
export async function createOrder(input: unknown) {
  const data = checkoutSchema.parse(input);
  if (data.website)
    throw new CheckoutError(
      "We couldn't place this order. Please contact the store.",
    );
  return db.transaction(async (tx) => {
    // The request UUID is also the order ID, making retries safe across processes.
    await tx
      .insert(customers)
      .values({ phone: data.phone, name: data.name })
      .onConflictDoNothing({ target: customers.phone });
    const [customer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.phone, data.phone))
      .for("update");
    if (customer.isBlocked)
      throw new CheckoutError(
        "We can't accept this order online. Please call the store for help.",
      );
    const [existing] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, data.requestId));
    if (existing) {
      if (existing.customerPhone !== data.phone)
        throw new CheckoutError("Please reload checkout and try again.");
      return { order: existing, created: false };
    }
    // Lock the same rows confirmation changes. Pending orders never reserve stock.
    await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        inArray(
          productVariants.id,
          data.lines.map((line) => line.variantId),
        ),
      )
      .orderBy(asc(productVariants.id))
      .for("update");
    const quote = await quoteCart(data.lines, tx);
    if (quote.messages.length || quote.items.length !== data.lines.length)
      throw new CheckoutError(
        "Your bag has changed. Review the updated prices and quantities before placing your order.",
      );
    // Coupons are re-validated against the locked, server-priced bag. The row
    // lock plus the guarded increment make the last remaining use single-winner.
    let coupon: AppliedCoupon | null = null;
    const typedCode = data.couponCode?.trim();
    if (typedCode && storeConfig.features.coupons) {
      const check = await checkCoupon(typedCode, quote.subtotal, tx, { lock: true });
      if (!check.ok)
        throw new CheckoutError(`${check.message} Remove the code to continue.`);
      if (!(await redeemCoupon(check.id!, tx)))
        throw new CheckoutError(`The coupon ${check.coupon.code} has reached its usage limit. Remove the code to continue.`);
      coupon = check.coupon;
    }
    if ((data.couponDiscount ?? 0) !== (coupon?.discount ?? 0))
      throw new CheckoutError(
        "Your coupon discount has changed. Review the updated total before placing your order.",
      );
    const totals = deliveryTotals(quote.subtotal, data.zoneId, coupon?.discount ?? 0);
    if (totals.total > 2_147_483_647)
      throw new CheckoutError(
        "Order total is too large. Please contact the store.",
      );
    const address = {
      line1: data.line1,
      area: data.area,
      city: data.city,
      zone_id: data.zoneId,
    };
    await tx
      .update(customers)
      .set({
        name: data.name,
        email: data.email || null,
        defaultAddress: address,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id));
    const [order] = await tx
      .insert(orders)
      .values({
        id: data.requestId,
        orderNumber: await nextOrderNumber(tx),
        customerId: customer.id,
        customerName: data.name,
        customerPhone: data.phone,
        customerEmail: data.email || null,
        shippingAddress: address,
        deliveryZoneId: data.zoneId,
        deliveryFee: totals.fee,
        subtotal: quote.subtotal,
        discount: totals.discount,
        couponCode: coupon?.code ?? null,
        total: totals.total,
        paymentMethod: data.paymentMethod,
        paymentTxnId: data.paymentMethod === "cod" ? null : data.txnId,
        customerNote: data.note || null,
      })
      .returning();
    await tx.insert(orderItems).values(
      quote.items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productName: item.name,
        variantLabel: item.label,
        brandName: item.brand,
        imageUrl: item.image,
        unitPrice: item.price,
        quantity: item.qty,
        lineTotal: item.price * item.qty,
      })),
    );
    await tx
      .insert(orderEvents)
      .values({
        orderId: order.id,
        type: "status_change",
        toStatus: "pending",
        actor: "system",
        message: "Order placed. Awaiting phone confirmation.",
      });
    return { order, created: true };
  });
}
