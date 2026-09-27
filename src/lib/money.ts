import { storeConfig, type StoreConfig } from "../../store.config";

function integer(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error("Money must be a safe integer in minor units.");
  return BigInt(value);
}

/** Format integer minor units without floating-point currency arithmetic. */
export function formatMoney(value: number, currency: StoreConfig["currency"] = storeConfig.currency): string {
  const amount = integer(value);
  const absolute = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(currency.minorUnits);
  const whole = (absolute / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, () => currency.thousandsSeparator);
  const fraction = currency.minorUnits ? `.${(absolute % scale).toString().padStart(currency.minorUnits, "0")}` : "";
  const number = `${whole}${fraction}`;
  const formatted = currency.symbolPosition === "before" ? `${currency.symbol}${number}` : `${number}${currency.symbol}`;
  return `${amount < 0n ? "-" : ""}${formatted}`;
}

/** Rounded percentage off MSRP. A zero MSRP or a price above MSRP has no discount. */
export function calcDiscountPercent(retailPrice: number, price: number): number {
  const retail = integer(retailPrice);
  const sale = integer(price);
  if (retail < 0n || sale < 0n) throw new Error("Prices cannot be negative.");
  if (retail === 0n || sale >= retail) return 0;
  return Number(((retail - sale) * 100n + retail / 2n) / retail);
}
