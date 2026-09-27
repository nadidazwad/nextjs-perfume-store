import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItems, orderEvents } from "@/db/schema";
export async function getPublicOrder(orderNumber: string, phone: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.orderNumber, orderNumber), eq(orders.customerPhone, phone)),
    );
  if (!order) return null;
  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.productName,
      brand: orderItems.brandName,
      label: orderItems.variantLabel,
      quantity: orderItems.quantity,
      lineTotal: orderItems.lineTotal,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  // Internal notes, call logs, actors and free-text admin messages stay private.
  const events = await db
    .select({
      id: orderEvents.id,
      status: orderEvents.toStatus,
      date: orderEvents.createdAt,
    })
    .from(orderEvents)
    .where(
      and(
        eq(orderEvents.orderId, order.id),
        eq(orderEvents.type, "status_change"),
      ),
    )
    .orderBy(asc(orderEvents.createdAt));
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    couponCode: order.couponCode,
    total: order.total,
    paymentMethod: order.paymentMethod,
    courier: order.courierName,
    trackingId: order.trackingId,
    items,
    events: events.map((event) => ({
      ...event,
      date: event.date.toISOString(),
    })),
  };
}
export type PublicOrder = NonNullable<
  Awaited<ReturnType<typeof getPublicOrder>>
>;
