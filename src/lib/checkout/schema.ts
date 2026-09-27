import { z } from "@/lib/zod";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { cartSchema } from "@/lib/cart/schema";
import { storeConfig as config } from "../../../store.config";
const required = (max: number) =>
  z.string().trim().min(1, "This field is required.").max(max);
export const checkoutSchema = z
  .object({
    name: required(120),
    phone: z
      .string()
      .max(30)
      .refine(
        isValidPhone,
        "Enter a valid Bangladesh mobile number, such as 01712345678.",
      )
      .transform(normalizePhone),
    email: z.union([z.literal(""), z.email().max(254)]).optional(),
    line1: required(240),
    area: required(100),
    city: required(100),
    zoneId: required(80).refine(
      (id) => config.checkout.deliveryZones.some((zone) => zone.id === id),
      "Choose a delivery zone.",
    ),
    paymentMethod: z
      .enum(["cod", "bkash", "nagad"])
      .refine(
        (key) => config.checkout.paymentMethods[key].enabled,
        "Choose an available payment method.",
      ),
    txnId: z.string().trim().max(80).optional(),
    note: z.string().trim().max(1000).optional(),
    website: z.string().max(200).optional(),
    // The server re-validates the code; the expected discount guards against
    // charging a different amount than the shopper saw.
    couponCode: z.string().trim().max(80).optional(),
    couponDiscount: z.int().nonnegative().max(2_147_483_647).optional(),
    lines: cartSchema.refine((lines) => lines.length > 0, "Your bag is empty."),
    requestId: z.uuid(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod !== "cod" && !data.txnId?.trim())
      ctx.addIssue({
        code: "custom",
        path: ["txnId"],
        message: "Enter the transaction ID from your payment.",
      });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;
/**
 * Order totals. The free-delivery threshold is measured on what the shopper
 * pays for goods, i.e. after any coupon discount.
 */
export function deliveryTotals(subtotal: number, zoneId: string, discount = 0) {
  const zone = config.checkout.deliveryZones.find((zone) => zone.id === zoneId);
  if (!zone) throw new Error("Choose a delivery zone.");
  const goods = subtotal - discount;
  const saving =
    config.checkout.freeDeliveryOver !== null &&
    goods >= config.checkout.freeDeliveryOver
      ? zone.fee
      : 0;
  return {
    fee: zone.fee - saving,
    saving,
    discount,
    total: goods + zone.fee - saving,
  };
}
export const trackingSchema = z.object({
  phone: z
    .string()
    .max(30)
    .refine(isValidPhone, "Enter a valid Bangladesh mobile number.")
    .transform(normalizePhone),
  orderNumber: required(40),
});
