import { z } from "zod";
import type { AppliedCoupon } from "@/lib/coupons/rules";

export const cartSchema = z
  .array(
    z.object({
      variantId: z.string().min(1).max(100),
      qty: z.int().min(1).max(999),
      // A display snapshot only. The server always supplies the actual price.
      price: z.int().nonnegative().optional(),
    }),
  )
  .max(50)
  .refine(
    (lines) =>
      new Set(lines.map((line) => line.variantId)).size === lines.length,
    "Duplicate bag items.",
  );
export type CartLine = z.infer<typeof cartSchema>[number];
export type CartItem = CartLine & {
  price: number;
  name: string;
  brand: string;
  slug: string;
  label: string;
  image: string | null;
  stock: number;
};
export type CartQuote = {
  items: CartItem[];
  messages: string[];
  subtotal: number;
  /** Coupon discount in minor units; 0 when none applies. Always server-computed. */
  discount: number;
  coupon: AppliedCoupon | null;
  /** Why the stored code doesn't apply right now (e.g. below minimum subtotal). */
  couponError: string;
};
