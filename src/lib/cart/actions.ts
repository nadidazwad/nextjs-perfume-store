"use server";
import { z } from "@/lib/zod";
import { quoteCart } from "./quote";
import { checkCoupon } from "@/lib/coupons/server";
import { COUPON_CODE_MAX } from "@/lib/coupons/rules";
import { storeConfig } from "../../../store.config";

/** Reasons that clear a stored code; others (like a low subtotal) keep it for later. */
const permanent = new Set(["not_found", "inactive", "expired", "used_up"]);
const codeSchema = z.string().max(COUPON_CODE_MAX * 2).optional();

export async function revalidateCart(input: unknown, couponCode?: unknown) {
  try {
    const quote = await quoteCart(input);
    const code = codeSchema.safeParse(couponCode);
    if (!storeConfig.features.coupons || !code.success || !code.data?.trim())
      return { quote, dropCoupon: Boolean(couponCode) && !storeConfig.features.coupons };
    const result = await checkCoupon(code.data, quote.subtotal);
    if (result.ok) {
      quote.coupon = result.coupon;
      quote.discount = result.coupon.discount;
      return { quote, dropCoupon: false };
    }
    quote.couponError = result.message;
    return { quote, dropCoupon: permanent.has(result.reason) };
  } catch {
    return { error: "We couldn't check your bag. Please try again." };
  }
}
