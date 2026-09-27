import Link from "next/link";
import { and, count, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderStatus, paymentMethod, type OrderStatus } from "@/db/schema";
import { PhoneCall, Search, X } from "lucide-react";
import { requireAdmin } from "@/lib/admin/session";
import { OrderTable } from "@/components/admin/order-table";
import { LinkTabs, PageHeader, Pagination } from "@/components/admin/ui";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/admin/format";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const p = await searchParams;
  const q = (p.q ?? "").slice(0, 160);
  const page = Math.max(1, Math.min(100000, Number(p.page) || 1));
  const status = orderStatus.enumValues.find((v) => v === p.status);
  const payment = paymentMethod.enumValues.find((v) => v === p.payment);
  const date = (value?: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value))
      ? new Date(`${value}T00:00:00+06:00`)
      : undefined;
  const from = date(p.from);
  const to = date(p.to);
  if (to) to.setUTCDate(to.getUTCDate() + 1);
  const where = and(
    status ? eq(orders.status, status) : undefined,
    payment ? eq(orders.paymentMethod, payment) : undefined,
    from ? gte(orders.createdAt, from) : undefined,
    to ? lt(orders.createdAt, to) : undefined,
    q
      ? or(
          ilike(orders.orderNumber, `%${q}%`),
          ilike(orders.customerPhone, `%${q}%`),
          ilike(orders.customerName, `%${q}%`),
        )
      : undefined,
  );
  const [rows, counts, [total]] = await Promise.all([
    db.query.orders.findMany({
      where,
      with: { items: true },
      orderBy: desc(orders.createdAt),
      limit: 25,
      offset: (page - 1) * 25,
    }),
    db
      .select({ status: orders.status, count: count() })
      .from(orders)
      .groupBy(orders.status),
    db.select({ count: count() }).from(orders).where(where),
  ]);
  const href = (changes: Record<string, string>) =>
    `/admin/orders?${new URLSearchParams(Object.fromEntries(Object.entries({ ...p, ...changes }).filter((v): v is [string, string] => Boolean(v[1]))))}`;
  const allCount = counts.reduce((sum, v) => sum + v.count, 0);
  const filtered = Boolean(q || payment || p.from || p.to);
  return (
    <>
      <PageHeader
        title="Orders"
        description={`${allCount} orders placed · confirm pending orders by phone before packing`}
        actions={
          <Link className="admin-btn primary" href="/admin/orders?status=pending">
            <PhoneCall size={16} /> Call queue
          </Link>
        }
      />
      <LinkTabs
        label="Order status"
        tabs={["all", ...orderStatus.enumValues].map((s) => ({
          href: href({ status: s, page: "1" }),
          label: s === "all" ? "All" : STATUS_LABELS[s as OrderStatus],
          count:
            s === "all"
              ? allCount
              : (counts.find((v) => v.status === s)?.count ?? 0),
          current: (status ?? "all") === s,
        }))}
      />
      <form className="admin-filters">
        <input type="hidden" name="status" value={status ?? "all"} />
        <label className="admin-search-field">
          <Search size={16} aria-hidden />
          <input
            name="q"
            type="search"
            aria-label="Search orders"
            placeholder="Order number, phone or name"
            defaultValue={q}
          />
        </label>
        <select
          name="payment"
          aria-label="Payment method"
          defaultValue={payment ?? ""}
        >
          <option value="">All payments</option>
          {paymentMethod.enumValues.map((v) => (
            <option key={v} value={v}>
              {PAYMENT_LABELS[v] ?? v}
            </option>
          ))}
        </select>
        <label className="admin-date">
          <span>From</span>
          <input name="from" type="date" defaultValue={p.from} />
        </label>
        <label className="admin-date">
          <span>Through</span>
          <input name="to" type="date" defaultValue={p.to} />
        </label>
        <button className="admin-btn dark">Apply</button>
        {filtered && (
          <Link className="admin-btn ghost" href={`/admin/orders${status ? `?status=${status}` : ""}`}>
            <X size={14} /> Clear
          </Link>
        )}
      </form>
      <OrderTable rows={rows} />
      <Pagination
        page={page}
        pageSize={25}
        total={total.count}
        noun="orders"
        href={(n) => href({ page: String(n) })}
      />
    </>
  );
}
