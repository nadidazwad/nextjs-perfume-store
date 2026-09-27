import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { Plus, TicketPercent } from "lucide-react";
import { db } from "@/db";
import { coupons, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { EmptyState, LinkTabs, PageHeader, Panel, Tag, type Tone } from "@/components/admin/ui";
import { CouponEditor, CouponSwitch } from "@/components/admin/coupon-editor";
import { OrderTable } from "@/components/admin/order-table";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/admin/format";
import { COUPON_STATE_LABELS, couponState, describeCoupon, type CouponState } from "@/lib/coupons/rules";
import { storeConfig } from "../../../../../store.config";

export const metadata = { title: "Coupons" };
const tones: Record<CouponState, Tone> = { live: "good", scheduled: "info", expired: "neutral", used_up: "warn", off: "neutral" };
const tabs = ["all", "live", "scheduled", "expired", "used_up", "off"] as const;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

function Window({ startsAt, endsAt }: { startsAt: Date | null; endsAt: Date | null }) {
  if (!startsAt && !endsAt) return <span className="admin-muted">Always</span>;
  return (
    <span className="admin-nowrap">
      {startsAt ? formatDate(startsAt) : "Now"} → {endsAt ? formatDate(endsAt) : "No end"}
    </span>
  );
}
function Uses({ used, max }: { used: number; max: number | null }) {
  return (
    <span className="admin-uses">
      <span>
        <strong>{used}</strong>
        <span className="admin-muted"> / {max ?? "∞"}</span>
      </span>
      {max !== null && (
        <span className="admin-meter" aria-hidden>
          <i style={{ width: `${Math.min(100, Math.round((used / max) * 100))}%` }} />
        </span>
      )}
    </span>
  );
}

export default async function Coupons({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  if (!storeConfig.features.coupons) notFound();
  const p = await searchParams;
  const now = new Date();

  if (p.id) {
    const [coupon] = p.id === "new" ? [] : await db.select().from(coupons).where(eq(coupons.id, p.id));
    if (p.id !== "new" && !coupon) notFound();
    const recent = coupon
      ? await db.select().from(orders).where(eq(orders.couponCode, coupon.code)).orderBy(desc(orders.createdAt)).limit(8)
      : [];
    const state = coupon ? couponState(coupon, now) : null;
    return (
      <>
        <PageHeader
          crumbs={[["Coupons", "/admin/coupons"]]}
          title={
            coupon ? (
              <span className="admin-title-row">
                <span className="admin-mono">{coupon.code}</span>
                <Tag tone={tones[state!]}>{COUPON_STATE_LABELS[state!]}</Tag>
              </span>
            ) : (
              "New coupon"
            )
          }
          description={coupon ? `${describeCoupon(coupon)} · last updated ${formatDate(coupon.updatedAt)}` : "Create a discount code for campaigns, influencers or loyal customers."}
        />
        <div className={coupon ? "admin-detail-grid" : "admin-form-page"}>
          <Panel>
            <CouponEditor
              key={coupon ? `${coupon.id}${coupon.updatedAt.toISOString()}` : "new"}
              initial={
                coupon && {
                  id: coupon.id,
                  code: coupon.code,
                  type: coupon.type,
                  value: coupon.value,
                  minSubtotal: coupon.minSubtotal,
                  maxUses: coupon.maxUses,
                  startsAt: iso(coupon.startsAt),
                  endsAt: iso(coupon.endsAt),
                  isActive: coupon.isActive,
                  usedCount: coupon.usedCount,
                }
              }
            />
          </Panel>
          {coupon && (
            <div className="admin-stack">
              <Panel title="Usage" description="Counted once per placed order.">
                <div className="admin-usage">
                  <strong className="admin-hero-number">{coupon.usedCount}</strong>
                  <span className="admin-muted">
                    {coupon.maxUses === null ? "uses, no limit" : `of ${coupon.maxUses} uses · ${Math.max(0, coupon.maxUses - coupon.usedCount)} left`}
                  </span>
                  {coupon.maxUses !== null && <Uses used={coupon.usedCount} max={coupon.maxUses} />}
                </div>
              </Panel>
              <Panel title="Recent orders" description={recent.length ? `Latest ${recent.length} with ${coupon.code}` : undefined}>
                <OrderTable rows={recent} empty="No orders have used this code yet." emptyHint={null} />
              </Panel>
            </div>
          )}
        </div>
      </>
    );
  }

  const [rows, [totals]] = await Promise.all([
    db.select().from(coupons).orderBy(desc(coupons.isActive), desc(coupons.createdAt)),
    db
      .select({
        redemptions: sql<number>`count(*)::int`,
        discount: sql<number>`coalesce(sum(${orders.discount}), 0)::int`,
      })
      .from(orders)
      .where(and(isNotNull(orders.couponCode), notInArray(orders.status, ["cancelled", "returned"]))),
  ]);
  const withState = rows.map((r) => ({ ...r, state: couponState(r, now) }));
  const tab = tabs.includes(p.tab as (typeof tabs)[number]) ? (p.tab as (typeof tabs)[number]) : "all";
  const visible = tab === "all" ? withState : withState.filter((r) => r.state === tab);
  const newButton = (
    <Link className="admin-btn primary" href="/admin/coupons?id=new">
      <Plus size={16} /> New coupon
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes shoppers enter in the bag or at checkout. Checked again when the order is placed."
        actions={newButton}
      />
      <div className="admin-kpis compact">
        {[
          ["Live now", withState.filter((r) => r.state === "live").length],
          ["Coupons", rows.length],
          ["Orders with a coupon", totals.redemptions],
          ["Discount given", formatMoney(totals.discount)],
        ].map(([label, value]) => (
          <div key={label} className="admin-kpi static">
            <span className="admin-kpi-label">{label}</span>
            <strong className="admin-kpi-value">{value}</strong>
          </div>
        ))}
      </div>
      <LinkTabs
        label="Coupon status"
        tabs={tabs.map((t) => ({
          href: t === "all" ? "/admin/coupons" : `/admin/coupons?tab=${t}`,
          label: t === "all" ? "All" : COUPON_STATE_LABELS[t],
          count: t === "all" ? rows.length : withState.filter((r) => r.state === t).length,
          current: tab === t,
        }))}
      />
      <div className="admin-table-card">
        {visible.length ? (
          <table className="admin-table admin-table-cards">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Minimum</th>
                <th>Window</th>
                <th>Uses</th>
                <th>Status</th>
                <th className="center">Active</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="admin-row-link">
                  <td>
                    <span className="admin-product-cell">
                      <span className="admin-icon-tile sm">
                        <TicketPercent size={15} />
                      </span>
                      <span>
                        <Link href={`/admin/coupons?id=${r.id}`} className="admin-stretch admin-strong admin-mono">
                          {r.code}
                        </Link>
                        <small>Created {formatDate(r.createdAt)}</small>
                      </span>
                    </span>
                  </td>
                  <td data-label="Discount" className="admin-strong">
                    {describeCoupon(r)}
                  </td>
                  <td data-label="Minimum">{r.minSubtotal ? formatMoney(r.minSubtotal) : <span className="admin-muted">None</span>}</td>
                  <td data-label="Window">
                    <Window startsAt={r.startsAt} endsAt={r.endsAt} />
                  </td>
                  <td data-label="Uses">
                    <Uses used={r.usedCount} max={r.maxUses} />
                  </td>
                  <td data-label="Status">
                    <Tag tone={tones[r.state]}>{COUPON_STATE_LABELS[r.state]}</Tag>
                  </td>
                  <td className="center" data-label="Active">
                    <CouponSwitch id={r.id} code={r.code} active={r.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon={<TicketPercent size={22} />}
            title={tab === "all" ? "No coupons yet" : `No ${COUPON_STATE_LABELS[tab].toLowerCase()} coupons`}
            action={tab === "all" ? newButton : undefined}
          >
            {tab === "all" ? "Create a code for a campaign, then share it with customers." : undefined}
          </EmptyState>
        )}
      </div>
    </>
  );
}
