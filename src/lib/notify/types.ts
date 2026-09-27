import type { orders, orderItems } from "@/db/schema";
export type OrderNotification = {
  order: typeof orders.$inferSelect;
  items: (typeof orderItems.$inferSelect)[];
};
export interface NotificationAdapter {
  send(subject: string, text: string): Promise<void>;
}
