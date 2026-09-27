import { and, eq, gte, sql } from "drizzle-orm";
import { db, type DbTransaction } from "@/db";
import {
  orderEvents,
  orderItems,
  orders,
  productVariants,
  type OrderStatus,
} from "@/db/schema";

import { ORDER_TRANSITIONS } from "./matrix";
export { ORDER_TRANSITIONS } from "./matrix";

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to))
    throw new Error(`Invalid order transition: ${from} → ${to}.`);
}
export type TransitionDetails = {
  actor: string;
  message?: string;
  cancelledReason?: string;
  courierName?: string;
  trackingId?: string;
  paymentVerified?: boolean;
  /** Used by seed/import to preserve historical event times. */
  occurredAt?: Date;
};

/** Callers must authorize admin actions before calling this server-side helper. */
export function transitionOrder(
  orderId: string,
  to: OrderStatus,
  details: TransitionDetails,
) {
  return db.transaction((tx) =>
    transitionOrderInTransaction(tx, orderId, to, details),
  );
}

/** Compose with seed/import transactions. A thrown error must abort the transaction. */
export async function transitionOrderInTransaction(
  tx: DbTransaction,
  orderId: string,
  to: OrderStatus,
  details: TransitionDetails,
) {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (!order) throw new Error("Order not found.");
  assertTransition(order.status, to);
  if (!details.actor.trim()) throw new Error("A transition needs an actor.");
  if (to === "cancelled" && !details.cancelledReason?.trim())
    throw new Error("A cancellation reason is required.");
  if (
    to === "shipped" &&
    !(details.courierName?.trim() && details.trackingId?.trim())
  )
    throw new Error("Courier name and tracking ID are required.");

  const confirming = order.status === "pending" && to === "confirmed";
  const restoring =
    (to === "cancelled" && order.status !== "pending") || to === "returned";
  const occurredAt = details.occurredAt ?? new Date();
  if (confirming || restoring) {
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    if (confirming && items.length === 0)
      throw new Error("Cannot confirm an empty order.");
    const quantities = new Map<string, number>();
    for (const item of items) {
      if (!item.variantId) {
        if (confirming)
          throw new Error(
            "An ordered variant was deleted. Resolve the order before confirming.",
          );
        continue; // Deleted catalog rows must not prevent closing a historical order.
      }
      quantities.set(
        item.variantId,
        (quantities.get(item.variantId) ?? 0) + item.quantity,
      );
    }
    // Consistent variant lock order avoids deadlocks between multi-item orders.
    for (const [variantId, quantity] of [...quantities].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const changed = await tx
        .update(productVariants)
        .set({
          stockQuantity: confirming
            ? sql`${productVariants.stockQuantity} - ${quantity}`
            : sql`${productVariants.stockQuantity} + ${quantity}`,
          updatedAt: occurredAt,
        })
        .where(
          confirming
            ? and(
                eq(productVariants.id, variantId),
                eq(productVariants.isActive, true),
                gte(productVariants.stockQuantity, quantity),
              )
            : eq(productVariants.id, variantId),
        )
        .returning({ id: productVariants.id });
      if (confirming && !changed.length)
        throw new Error(
          `Insufficient stock or inactive variant: ${variantId}.`,
        );
    }
  }
  const [updated] = await tx
    .update(orders)
    .set({
      status: to,
      updatedAt: occurredAt,
      ...(to === "cancelled"
        ? { cancelledReason: details.cancelledReason!.trim() }
        : {}),
      ...(to === "shipped"
        ? {
            courierName: details.courierName!.trim(),
            trackingId: details.trackingId!.trim(),
          }
        : {}),
      ...(details.paymentVerified !== undefined
        ? { paymentVerified: details.paymentVerified }
        : {}),
    })
    .where(eq(orders.id, orderId))
    .returning();
  await tx.insert(orderEvents).values({
    orderId,
    type: "status_change",
    fromStatus: order.status,
    toStatus: to,
    actor: details.actor,
    message: details.message,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });
  return updated;
}
