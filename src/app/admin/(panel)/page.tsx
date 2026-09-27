import Image from "next/image";
import Link from "next/link";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  Clock,
  Package,
  Phone,
  PhoneCall,
  Plus,
  ShoppingBag,
  StickyNote,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Info,
} from "lucide-react";
import { db } from "@/db";
import {
  orders,
  orderEvents,
  orderStatus,
  productImages,
  productVariants,
  type OrderStatus,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { formatMoney } from "@/lib/money";
import {
  ADMIN_TIME_ZONE,
  PAYMENT_LABELS,
  STATUS_LABELS,
  formatDate,
  hoursSince,
  timeAgo,
} from "@/lib/admin/format";
import { Avatar, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { storeConfig } from "../../../../store.config";

const CONFIRMED_OR_LATER = sql.raw(`('confirmed','packed','shipped','delivered')`);
const DAYS = 14;
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: ADMIN_TIME_ZONE });
/** Round an axis maximum up to 1, 2, 2.5 or 5 × 10ⁿ so gridlines land on clean values. */
function niceCeil(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((step) => step * power >= value) ?? 10) * power;
}

export default async function Dashboard() {
  const user = await requireAdmin();
  const lowStock = sql`${productVariants.isActive} = true and ${productVariants.stockQuantity} <= coalesce(${productVariants.lowStockOverride}, ${storeConfig.catalog.lowStockThreshold})`;
  const [queue, events, [stats], [stock], lowRows, statusCounts, daily] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.status, "pending"),
      orderBy: asc(orders.createdAt),
      with: { items: true },
    }),
    db.query.orderEvents.findMany({
      orderBy: desc(orderEvents.createdAt),
      limit: 20,
      with: { order: true },
    }),
    db
      .select({
        now: sql<string>`now()`,
        today: sql<number>`count(*) filter (where (${orders.createdAt} at time zone 'Asia/Dhaka')::date = (now() at time zone 'Asia/Dhaka')::date)::int`,
        revenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ${CONFIRMED_OR_LATER} and ${orders.createdAt} >= (date_trunc('week', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')), 0)`,
      })
      .from(orders),
    db.select({ count: count() }).from(productVariants).where(lowStock),
    db.query.productVariants.findMany({
      where: lowStock,
      orderBy: asc(productVariants.stockQuantity),
      limit: 5,
      with: {
        product: {
          with: {
            brand: true,
            images: { orderBy: asc(productImages.sortOrder), limit: 1 },
          },
        },
      },
    }),
    db.select({ status: orders.status, count: count() }).from(orders).groupBy(orders.status),
    db
      .select({
        day: sql<string>`to_char((${orders.createdAt} at time zone 'Asia/Dhaka')::date, 'YYYY-MM-DD')`,
        orders: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ${CONFIRMED_OR_LATER}), 0)::bigint`,
      })
      .from(orders)
      .where(sql`${orders.createdAt} >= now() - interval '${sql.raw(String(DAYS * 2 + 1))} days'`)
      .groupBy(sql`1`),
  ]);

  const now = new Date(stats.now);
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: DAYS * 2 }, (_, i) => {
    const date = new Date(now.getTime() - (DAYS * 2 - 1 - i) * 86400000);
    const row = byDay.get(dayKey(date));
    return { date, orders: Number(row?.orders ?? 0), revenue: Number(row?.revenue ?? 0) };
  });
  const previous = series.slice(0, DAYS);
  const current = series.slice(DAYS);
  const periodRevenue = current.reduce((sum, d) => sum + d.revenue, 0);
  const periodOrders = current.reduce((sum, d) => sum + d.orders, 0);
  const previousRevenue = previous.reduce((sum, d) => sum + d.revenue, 0);
  const change = previousRevenue ? (periodRevenue - previousRevenue) / previousRevenue : null;
  const axisMax = niceCeil(Math.max(...current.map((d) => d.revenue)));

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.count])) as Partial<
    Record<OrderStatus, number>
  >;
  const open = (["pending", "confirmed", "packed", "shipped"] as const).map((status) => ({
    status,
    count: counts[status] ?? 0,
  }));
  const openTotal = open.reduce((sum, s) => sum + s.count, 0);
  const allTotal = orderStatus.enumValues.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  const hour = Number(now.toLocaleString("en-GB", { timeZone: ADMIN_TIME_ZONE, hour: "2-digit", hour12: false }));
  const greeting = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const tiles = [
    {
      label: "Waiting for a call",
      value: queue.length,
      hint: queue.length ? `Oldest ${timeAgo(queue[0].createdAt, now)}` : "Queue is clear",
      href: "#call-queue",
      icon: PhoneCall,
      tone: queue.length ? "warn" : "good",
    },
    {
      label: "Orders today",
      value: stats.today,
      hint: `${periodOrders} in the last ${DAYS} days`,
      href: "/admin/orders",
      icon: ShoppingBag,
    },
    {
      label: "Revenue this week",
      value: formatMoney(Number(stats.revenue)),
      hint: "Confirmed orders onward",
      href: "/admin/orders?status=delivered",
      icon: Wallet,
    },
    {
      label: "Low-stock variants",
      value: stock.count,
      hint: stock.count ? "Restock soon" : "All stocked",
      href: "/admin/products?stock=low",
      icon: Package,
      tone: stock.count ? "bad" : undefined,
    },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name || "there"}`}
        description={`${formatDate(now, { weekday: "long", day: "numeric", month: "long" })} · ${
          queue.length
            ? `${queue.length} ${queue.length === 1 ? "customer is" : "customers are"} waiting for a confirmation call.`
            : "No confirmation calls waiting."
        }`}
        actions={
          <>
            <Link className="admin-btn" href="/admin/orders">
              All orders
            </Link>
            <Link className="admin-btn primary" href="/admin/products/new">
              <Plus size={16} /> New product
            </Link>
          </>
        }
      />

      <div className="admin-kpis">
        {tiles.map(({ label, value, hint, href, icon: Icon, tone }) => (
          <Link key={label} href={href} className="admin-kpi" data-tone={tone}>
            <span className="admin-kpi-head">
              <span className="admin-icon-tile">
                <Icon size={18} strokeWidth={1.7} />
              </span>
              <ArrowUpRight size={16} className="admin-kpi-arrow" aria-hidden />
            </span>
            <span className="admin-kpi-label">{label}</span>
            <strong className="admin-kpi-value">{value}</strong>
            <span className="admin-kpi-hint">{hint}</span>
          </Link>
        ))}
      </div>

      <div className="admin-dash-grid">
        <div className="admin-stack">
        <Panel
          id="call-queue"
          className="admin-queue-panel"
          title="Call queue"
          description="Pending orders, oldest first. Confirm each by phone before packing."
          actions={
            <Link className="admin-btn sm ghost" href="/admin/orders?status=pending">
              Open list <ArrowRight size={14} />
            </Link>
          }
        >
          {queue.length ? (
            <ol className="admin-queue">
              {queue.map((o, index) => {
                const age = hoursSince(o.createdAt, now);
                return (
                  <li key={o.id} className="admin-queue-item">
                    <span className="admin-queue-rank">{index + 1}</span>
                    <Avatar name={o.customerName} />
                    <div className="admin-queue-who">
                      <Link href={`/admin/orders/${o.id}`} className="admin-stretch">
                        {o.customerName}
                      </Link>
                      <span>
                        {o.orderNumber} · {o.items.reduce((sum, i) => sum + i.quantity, 0)} items ·{" "}
                        {PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod}
                      </span>
                    </div>
                    <span className="admin-age" data-urgency={age >= 24 ? "high" : age >= 6 ? "mid" : "low"}>
                      <Clock size={13} /> {timeAgo(o.createdAt, now)}
                    </span>
                    <strong className="admin-queue-total">{formatMoney(o.total)}</strong>
                    <a className="admin-btn sm call" href={`tel:${o.customerPhone}`} aria-label={`Call ${o.customerName} on ${o.customerPhone}`}>
                      <Phone size={14} /> <span className="admin-hide-sm">{o.customerPhone}</span><span className="admin-show-sm">Call</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState icon={<CircleCheck size={22} />} title="Everyone has been called">
              New orders will appear here, oldest first.
            </EmptyState>
          )}
        </Panel>

        <Panel
          className="admin-chart-panel"
          title="Revenue"
          description={`Confirmed orders onward, last ${DAYS} days`}
        >
          <div className="admin-hero-number">
            <strong>{formatMoney(periodRevenue)}</strong>
            {change !== null && (
              <span className="admin-delta" data-dir={change >= 0 ? "up" : "down"}>
                {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(Math.round(change * 100))}%
                <span className="admin-muted"> vs previous {DAYS} days</span>
              </span>
            )}
          </div>
          <div className="admin-chart" aria-hidden>
            <div className="admin-chart-grid">
              {[1, 0.5, 0].map((f) => (
                <span key={f}>
                  <em>{f === 0 ? "0" : formatMoney(Math.round(axisMax * f))}</em>
                </span>
              ))}
            </div>
            <div className="admin-chart-bars">
              {current.map((d, i) => (
                <div
                  key={i}
                  className="admin-chart-col"
                  tabIndex={0}
                  data-edge={i < 3 ? "start" : i > DAYS - 4 ? "end" : undefined}
                >
                  <span className="admin-chart-bar" style={{ height: `${(d.revenue / axisMax) * 100}%` }} data-zero={d.revenue === 0 || undefined} />
                  <span className="admin-chart-tip">
                    <strong>{formatMoney(d.revenue)}</strong>
                    <span>
                      {d.orders} {d.orders === 1 ? "order" : "orders"} · {formatDate(d.date, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="admin-chart-x" data-odd={i % 2 === 1 || undefined}>
                    {formatDate(d.date, { day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <table className="admin-sr-only">
            <caption>Revenue by day, last {DAYS} days</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {current.map((d, i) => (
                <tr key={i}>
                  <td>{formatDate(d.date)}</td>
                  <td>{d.orders}</td>
                  <td>{formatMoney(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        </div>
        <div className="admin-stack">
          <Panel
            title="Order pipeline"
            description={`${openTotal} open · ${allTotal} all time`}
          >
            <div className="admin-pipeline-bar" role="img" aria-label={open.map((s) => `${STATUS_LABELS[s.status]} ${s.count}`).join(", ")}>
              {open
                .filter((s) => s.count > 0)
                .map((s) => (
                  <span key={s.status} data-status={s.status} style={{ flexGrow: s.count }} />
                ))}
              {!openTotal && <span className="empty" />}
            </div>
            <ul className="admin-pipeline">
              {orderStatus.enumValues.map((status) => (
                <li key={status}>
                  <Link href={`/admin/orders?status=${status}`}>
                    <StatusBadge status={status} />
                    <strong>{counts[status] ?? 0}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Running low"
            description={`At or below ${storeConfig.catalog.lowStockThreshold} units`}
            actions={
              stock.count > 0 && (
                <Link className="admin-btn sm ghost" href="/admin/products?stock=low">
                  View all
                </Link>
              )
            }
          >
            {lowRows.length ? (
              <ul className="admin-lowstock">
                {lowRows.map((v) => (
                  <li key={v.id}>
                    <span className="admin-thumb sm">
                      {v.product.images[0] && (
                        <Image unoptimized src={v.product.images[0].url} alt="" width={40} height={40} />
                      )}
                    </span>
                    <span className="admin-lowstock-name">
                      <Link href={`/admin/products/${v.productId}`} className="admin-stretch">
                        {v.product.name}
                      </Link>
                      <small>
                        {v.product.brand.name} · {v.sizeLabel ?? `${v.sizeMl} ml`}
                      </small>
                    </span>
                    <span className="admin-tag" data-tone={v.stockQuantity === 0 ? "bad" : "warn"}>
                      {v.stockQuantity === 0 ? "Sold out" : `${v.stockQuantity} left`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CircleCheck size={22} />} title="Stock looks healthy" />
            )}
          </Panel>
        <Panel className="admin-activity-panel" title="Recent activity" description="Latest 20 order events">
          {events.length ? (
            <ol className="admin-activity">
              {events.map((e) => {
                const Icon =
                  e.type === "call_logged" ? Phone : e.type === "note" ? StickyNote : e.type === "system" ? Info : e.toStatus === "cancelled" || e.toStatus === "returned" ? TriangleAlert : CircleCheck;
                return (
                  <li key={e.id} data-type={e.type} data-status={e.toStatus ?? undefined}>
                    <span className="admin-activity-icon">
                      <Icon size={14} />
                    </span>
                    <span className="admin-activity-body">
                      <span>
                        <Link href={`/admin/orders/${e.orderId}`}>{e.order.orderNumber}</Link>{" "}
                        {e.type === "status_change" && e.toStatus
                          ? e.fromStatus
                            ? `moved to ${STATUS_LABELS[e.toStatus].toLowerCase()}`
                            : "was placed"
                          : e.type === "call_logged"
                            ? "call logged"
                            : e.type === "note"
                              ? "note added"
                              : "updated"}
                      </span>
                      {e.message && e.type !== "status_change" && <small>{e.message}</small>}
                    </span>
                    <time dateTime={e.createdAt.toISOString()}>{timeAgo(e.createdAt, now)}</time>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState title="No activity yet" />
          )}
        </Panel>
        </div>
      </div>
    </>
  );
}
