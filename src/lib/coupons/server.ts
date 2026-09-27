import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { coupons } from "@/db/schema";
import { storeConfig } from "../../../store.config";
import { evaluateCoupon, normalizeCouponCode, type CouponCheck } from "./rules";

/** Look up and validate a code against a server-computed subtotal. */
export async function checkCoupon(
  typed: string,
  subtotal: number,
  executor: DbExecutor = db,
  options: { lock?: boolean; now?: Date } = {},
): Promise<CouponCheck & { id?: string }> {
  if (!storeConfig.features.coupons)
    return { ok: false, reason: "not_found", message: "Coupons aren't available in this store." };
  const code = normalizeCouponCode(typed);
  if (!code) return evaluateCoupon(null, subtotal, options.now, code);
  const query = executor.select().from(coupons).where(eq(coupons.code, code));
  const [row] = options.lock ? await query.for("update") : await query;
  const result = evaluateCoupon(row ?? null, subtotal, options.now, code);
  return result.ok ? { ...result, id: row!.id } : result;
}

/**
 * Count one use inside the order transaction. The WHERE clause re-checks the
 * limit so two concurrent orders can never both take the last use.
 */
export async function redeemCoupon(id: string, executor: DbExecutor) {
  const rows = await executor
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        eq(coupons.id, id),
        eq(coupons.isActive, true),
        or(isNull(coupons.maxUses), lt(coupons.usedCount, coupons.maxUses)),
      ),
    )
    .returning({ id: coupons.id });
  return rows.length === 1;
}
