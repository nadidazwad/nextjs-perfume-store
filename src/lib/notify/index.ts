import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { storeConfig } from "../../../store.config";
import { consoleAdapter } from "./console";
import { resendAdapter } from "./resend";
import { telegramAdapter } from "./telegram";
import type { OrderNotification } from "./types";
const adapters = {
  console: consoleAdapter,
  resend: resendAdapter,
  telegram: telegramAdapter,
};
async function send(subject: string, text: string) {
  try {
    await adapters[env.NOTIFY_ADAPTER].send(subject, text);
    return true;
  } catch {
    // Do not log provider errors: they can contain credentials or response payloads.
    console.error(
      "Order notification failed. Check notification settings; the order is saved.",
    );
    return false;
  }
}
/**
 * Platform logs are not a customer database. In production the console adapter
 * gets a summary without contact details; the full order stays behind the
 * admin login. Chat and email adapters deliver the full text to the team.
 */
export function orderNotificationText(
  { order, items }: OrderNotification,
  { redact }: { redact: boolean },
) {
  const link = `${env.NEXT_PUBLIC_APP_URL}/admin/orders/${order.id}`;
  if (redact)
    return [
      `${items.reduce((sum, item) => sum + item.quantity, 0)} item(s) | Total: ${formatMoney(order.total)} | Payment: ${order.paymentMethod}`,
      `Details: ${link}`,
      "Set NOTIFY_ADAPTER=telegram or resend to receive full order alerts.",
    ].join("\n");
  const address = order.shippingAddress;
  return [
    `${order.customerName} | ${order.customerPhone}`,
    `${address.line1}, ${address.area}, ${address.city}`,
    ...items.map(
      (item) =>
        `${item.quantity} × ${item.brandName} ${item.productName} / ${item.variantLabel}: ${formatMoney(item.lineTotal)}`,
    ),
    ...(order.discount > 0
      ? [`Coupon${order.couponCode ? ` ${order.couponCode}` : ""}: −${formatMoney(order.discount)}`]
      : []),
    `Delivery: ${formatMoney(order.deliveryFee)} | Total: ${formatMoney(order.total)}`,
    `Payment: ${order.paymentMethod}${order.paymentTxnId ? ` | TrxID: ${order.paymentTxnId}` : ""}`,
    `Call to confirm. ${link}`,
  ].join("\n");
}
export async function notifyNewOrder(notification: OrderNotification) {
  await send(
    `${storeConfig.store.name}: ${notification.order.orderNumber}`,
    orderNotificationText(notification, {
      redact: env.NOTIFY_ADAPTER === "console" && env.NODE_ENV === "production",
    }),
  );
}
export async function notifyTestPing() {
  return send(
    `${storeConfig.store.name}: test notification`,
    "Order notifications are connected.",
  );
}
