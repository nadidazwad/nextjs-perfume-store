import Link from "next/link";
import { ChevronRight, ShieldCheck, ShoppingBag } from "lucide-react";
import type { orders, orderItems } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { PAYMENT_LABELS, formatDateTime } from "@/lib/admin/format";
import { Avatar, EmptyState, StatusBadge } from "./ui";
type Row = typeof orders.$inferSelect & {
  items?: (typeof orderItems.$inferSelect)[];
};
function Payment({ o }: { o: Row }) {
  return (
    <span className="admin-payment">
      {PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod}
      {o.paymentMethod !== "cod" &&
        (o.paymentVerified ? (
          <span className="admin-tag" data-tone="good">
            <ShieldCheck size={12} /> Verified
          </span>
        ) : (
          <span className="admin-tag" data-tone="warn">
            Unverified
          </span>
        ))}
    </span>
  );
}
export function OrderTable({
  rows,
  empty = "No orders match these filters.",
  emptyHint = "Try a different status tab or clear the filters.",
  showCustomer = true,
}: {
  rows: Row[];
  empty?: string;
  /** Secondary empty-state line; null hides it (e.g. lists without filters). */
  emptyHint?: string | null;
  showCustomer?: boolean;
}) {
  if (!rows.length)
    return (
      <div className="admin-table-card">
        <EmptyState icon={<ShoppingBag size={22} />} title={empty}>
          {emptyHint}
        </EmptyState>
      </div>
    );
  return (
    <div className="admin-table-card">
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th>Order</th>
            {showCustomer && <th>Customer</th>}
            <th className="num">Items</th>
            <th className="num">Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="admin-row-link">
              <td className="admin-nowrap">
                <Link href={`/admin/orders/${o.id}`} className="admin-stretch admin-strong">
                  {o.orderNumber}
                </Link>
                <small>{formatDateTime(o.createdAt)}</small>
              </td>
              {showCustomer && <td>
                <span className="admin-person">
                  <Avatar name={o.customerName} size="sm" />
                  <span>
                    {o.customerName}
                    <small>
                      <a href={`tel:${o.customerPhone}`} className="admin-above">
                        {o.customerPhone}
                      </a>
                    </small>
                  </span>
                </span>
              </td>}
              <td className="num">{o.items?.reduce((sum, i) => sum + i.quantity, 0) ?? "—"}</td>
              <td className="num admin-strong">{formatMoney(o.total)}</td>
              <td>
                <Payment o={o} />
              </td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              <td className="admin-chevron">
                <ChevronRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="admin-cards admin-mobile-only">
        {rows.map((o) => (
          <li key={o.id} className="admin-card-row">
            <div className="admin-card-row-top">
              <Link href={`/admin/orders/${o.id}`} className="admin-stretch admin-strong">
                {o.orderNumber}
              </Link>
              <StatusBadge status={o.status} />
            </div>
            <div className="admin-card-row-mid">
              <span>
                {o.customerName}
                <small>
                  <a href={`tel:${o.customerPhone}`} className="admin-above">
                    {o.customerPhone}
                  </a>
                </small>
              </span>
              <strong>{formatMoney(o.total)}</strong>
            </div>
            <div className="admin-card-row-foot">
              <span>{formatDateTime(o.createdAt)}</span>
              <Payment o={o} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
