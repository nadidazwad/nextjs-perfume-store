import { formatMoney } from "@/lib/money";
import { ADMIN_TIME_ZONE } from "@/lib/admin/format";

/** Pure coupon rules, shared by the cart quote, checkout and tests. No DB access here. */
export type CouponRecord = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};
export type AppliedCoupon = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number;
};
export type CouponCheck =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; reason: CouponFailure; message: string };
export type CouponFailure =
  | "empty"
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "used_up"
  | "min_subtotal"
  | "empty_bag";

export const COUPON_CODE_MAX = 40;

/** Codes are case-insensitive for shoppers; stored uppercase (DB check enforces it). */
export function normalizeCouponCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase().slice(0, COUPON_CODE_MAX);
}

/**
 * Discount in minor units against the merchandise subtotal (never delivery).
 * Percent rounds down so the store never gives away a fraction of a unit;
 * a fixed amount is capped at the subtotal so totals can't go negative.
 */
export function couponDiscount(type: "percent" | "fixed", value: number, subtotal: number) {
  if (!Number.isSafeInteger(subtotal) || subtotal <= 0) return 0;
  if (!Number.isSafeInteger(value) || value <= 0) return 0;
  if (type === "percent") {
    const percent = Math.min(value, 100);
    return Number((BigInt(subtotal) * BigInt(percent)) / 100n);
  }
  return Math.min(value, subtotal);
}

/** Validate every rule in a fixed order so the shopper gets the most useful message. */
export function evaluateCoupon(
  coupon: CouponRecord | null | undefined,
  subtotal: number,
  now: Date = new Date(),
  typed = coupon?.code ?? "",
): CouponCheck {
  const code = normalizeCouponCode(typed);
  const fail = (reason: CouponFailure, message: string): CouponCheck => ({ ok: false, reason, message });
  if (!code) return fail("empty", "Enter a coupon code.");
  if (!coupon) return fail("not_found", `“${code}” isn't a valid coupon code. Check the spelling and try again.`);
  if (!coupon.isActive) return fail("inactive", `The coupon ${coupon.code} is no longer active.`);
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime())
    return fail("not_started", `The coupon ${coupon.code} isn't active yet. It starts ${formatWhen(coupon.startsAt)}.`);
  if (coupon.endsAt && coupon.endsAt.getTime() <= now.getTime())
    return fail("expired", `The coupon ${coupon.code} expired on ${formatWhen(coupon.endsAt)}.`);
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
    return fail("used_up", `The coupon ${coupon.code} has reached its usage limit.`);
  if (subtotal <= 0) return fail("empty_bag", "Add items to your bag before applying a coupon.");
  if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal)
    return fail(
      "min_subtotal",
      `Spend ${formatMoney(coupon.minSubtotal - subtotal)} more to use ${coupon.code}. It needs a subtotal of ${formatMoney(coupon.minSubtotal)}.`,
    );
  return {
    ok: true,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount: couponDiscount(coupon.type, coupon.value, subtotal),
    },
  };
}

export function describeCoupon(coupon: Pick<AppliedCoupon, "type" | "value">) {
  return coupon.type === "percent" ? `${coupon.value}% off` : `${formatMoney(coupon.value)} off`;
}

function formatWhen(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ADMIN_TIME_ZONE });
}

/** Readable, unambiguous codes for the admin generator (no 0/O, 1/I). */
export function generateCouponCode(length = 8, random: (max: number) => number = (max) => Math.floor(Math.random() * max)) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += alphabet[random(alphabet.length)];
  return code;
}

export type CouponState = "live" | "scheduled" | "expired" | "used_up" | "off";
/** Admin-facing lifecycle state. "live" means a qualifying bag can use it right now. */
export function couponState(
  coupon: Pick<CouponRecord, "isActive" | "startsAt" | "endsAt" | "maxUses" | "usedCount">,
  now: Date = new Date(),
): CouponState {
  if (!coupon.isActive) return "off";
  if (coupon.endsAt && coupon.endsAt.getTime() <= now.getTime()) return "expired";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "used_up";
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return "scheduled";
  return "live";
}
export const COUPON_STATE_LABELS: Record<CouponState, string> = {
  live: "Live",
  scheduled: "Scheduled",
  expired: "Expired",
  used_up: "Used up",
  off: "Off",
};
