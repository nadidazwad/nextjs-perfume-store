import type { OrderStatus } from "@/db/schema";

/** Admin dates are shown in the store's operating timezone. */
export const ADMIN_TIME_ZONE = "Asia/Dhaka";

export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  return date.toLocaleString("en-GB", { timeZone: ADMIN_TIME_ZONE, ...options });
}

export function formatDateTime(date: Date) {
  return formatDate(date, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Compact relative age, e.g. "just now", "12 min", "3 h", "2 d". */
export function timeAgo(date: Date, now: Date = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} d ago` : formatDate(date);
}

export function hoursSince(date: Date, now: Date = new Date()) {
  return Math.max(0, (now.getTime() - date.getTime()) / 3600000);
}

export function ordinal(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function humanize(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** The happy path an order walks; cancelled/returned branch off it. */
export const FULFILMENT_STEPS = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

export const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  bkash: "bKash",
  nagad: "Nagad",
};

/** wa.me wants digits only, including the country code. */
export function whatsappHref(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
