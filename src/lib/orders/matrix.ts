import type { OrderStatus } from "@/db/schema";
export const ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: [],
  cancelled: [],
  returned: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;
