import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, count, desc, eq, ilike, or } from "drizzle-orm";
import {
  ArrowUpRight,
  Ban,
  Bell,
  ChevronRight,
  Database,
  FileText,
  HardDrive,
  Layers,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Star,
  Tag as TagIcon,
  Users,
  X,
} from "lucide-react";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { editorChoices } from "@/lib/admin/choices";
import { EntityEditor } from "@/components/admin/entity-editor";
import { Sortable } from "@/components/admin/sortable";
import { OrderTable } from "@/components/admin/order-table";
import { TestNotification } from "@/components/admin/diagnostics";
import {
  Avatar,
  EmptyState,
  LinkTabs,
  PageHeader,
  Panel,
  Tag,
} from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { formatDate, humanize, whatsappHref } from "@/lib/admin/format";
import { env } from "@/lib/env";
import { storeConfig } from "../../../../../store.config";
import type { Entity } from "@/lib/admin/schema";
const titles: Record<string, string> = {
  brands: "Brands",
  taxonomy: "Taxonomy",
  banners: "Banners",
  homepage: "Homepage",
  customers: "Customers",
  pages: "Pages",
  settings: "Settings",
};
const descriptions: Record<string, string> = {
  brands: "The houses you stock. Featured brands appear in the homepage strip.",
  notes: "Scent notes shoppers filter by, grouped into families.",
  collections: "Saved filters that power curated collection pages.",
  banners: "Announcements, hero slides, event cards and promo strips. Drag to set their order.",
  homepage: "The storefront homepage, top to bottom. Drag sections to rearrange.",
  pages: "Static content like About, Delivery and Returns.",
  customers: "Everyone who has ordered, identified by phone number.",
};
const singular: Record<Entity, string> = {
  brands: "brand",
  notes: "note",
  collections: "collection",
  banners: "banner",
  homepage: "section",
  pages: "page",
  customers: "customer",
};
const placementLabels: Record<string, string> = {
  announcement: "Announcement bar",
  hero: "Hero slides",
  event_card: "Event cards",
  promo_strip: "Promo strip",
};
function ConfigValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="admin-muted">Not set</span>;
  if (typeof value === "boolean")
    return <Tag tone={value ? "good" : "neutral"}>{value ? "On" : "Off"}</Tag>;
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value))
    return (
      <span className="admin-swatch">
        <i style={{ background: value }} /> {value}
      </span>
    );
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="admin-muted">None</span>;
    if (value.every((v) => typeof v !== "object"))
      return <span>{value.join(", ")}</span>;
    return (
      <div className="admin-config-list">
        {value.map((v, i) => (
          <div key={i} className="admin-config-item">
            <ConfigValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="admin-config">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt>{humanize(k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())}</dt>
          <dd>
            <ConfigValue value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default async function Section({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { section } = await params;
  const p = await searchParams;
  if (!titles[section]) notFound();
  if (section === "settings") {
    const adapters = [
      {
        icon: Database,
        title: "Database",
        value: env.DATABASE_URL ? "Postgres" : "PGlite",
        detail: env.DATABASE_URL
          ? "Connected through DATABASE_URL."
          : "Embedded local database for development. Set DATABASE_URL before going live.",
        ok: Boolean(env.DATABASE_URL),
      },
      {
        icon: Bell,
        title: "Notifications",
        value: humanize(env.NOTIFY_ADAPTER),
        detail:
          env.NOTIFY_ADAPTER === "console"
            ? "New-order alerts are only written to the server log."
            : "New-order alerts are delivered to your team.",
        ok: env.NOTIFY_ADAPTER !== "console",
      },
      {
        icon: HardDrive,
        title: "Image storage",
        value: env.STORAGE_ADAPTER === "local" ? "Local disk" : "S3-compatible",
        detail:
          env.STORAGE_ADAPTER === "local"
            ? "Uploads are saved to public/uploads. Needs a writable, persistent disk."
            : "Uploads go to your object storage bucket.",
        ok: env.STORAGE_ADAPTER !== "local",
      },
    ];
    return (
      <>
        <PageHeader
          title="Settings"
          description="Live adapter status and the store configuration this deployment is running."
        />
        <div className="admin-adapters">
          {adapters.map(({ icon: Icon, title, value, detail, ok }) => (
            <div key={title} className="admin-adapter" data-ok={ok || undefined}>
              <span className="admin-icon-tile">
                <Icon size={18} strokeWidth={1.7} />
              </span>
              <small>{title}</small>
              <strong>{value}</strong>
              <span className="admin-adapter-state">
                <i aria-hidden />
                {ok ? "Production ready" : "Development default"}
              </span>
              <p>{detail}</p>
            </div>
          ))}
        </div>
        <div className="admin-detail-grid">
          <Panel
            title="Store configuration"
            description="Read-only. Edit store.config.ts and redeploy to change these."
          >
            <div className="admin-config-groups">
              {Object.entries(storeConfig).map(([group, value], i) => (
                <details key={group} open={i === 0}>
                  <summary>
                    {humanize(group.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())}
                    <ChevronRight size={16} />
                  </summary>
                  <ConfigValue value={value} />
                </details>
              ))}
            </div>
          </Panel>
          <div className="admin-stack">
            <Panel
              title="Test notifications"
              description={
                env.DEMO_MODE
                  ? "Turned off in the demo: order alerts only reach the server log."
                  : `Sends a test message through the ${env.NOTIFY_ADAPTER} adapter.`
              }
            >
              {!env.DEMO_MODE && <TestNotification />}
            </Panel>
            <Panel title="Storage check">
              <p className="admin-muted">
                Upload any image from a product or brand to confirm storage works. Uploads are resized
                to WebP in the browser first.
              </p>
            </Panel>
          </div>
        </div>
      </>
    );
  }
  const choices = await editorChoices();
  const entity: Entity =
    section === "taxonomy"
      ? p.tab === "collections"
        ? "collections"
        : "notes"
      : (section as Entity);
  const base = `/admin/${section}${section === "taxonomy" ? `?tab=${entity}` : ""}`;
  const href = (id: string) =>
    `${base}${base.includes("?") ? "&" : "?"}id=${id}`;
  let rows: Record<string, unknown>[] = [];
  if (entity === "brands")
    rows = await db
      .select()
      .from(s.brands)
      .orderBy(asc(s.brands.sortOrder), asc(s.brands.name));
  if (entity === "notes")
    rows = await db
      .select()
      .from(s.notes)
      .orderBy(asc(s.notes.group), asc(s.notes.name));
  if (entity === "collections")
    rows = await db
      .select()
      .from(s.collections)
      .orderBy(asc(s.collections.sortOrder));
  if (entity === "banners")
    rows = await db.select().from(s.banners).orderBy(asc(s.banners.sortOrder));
  if (entity === "homepage")
    rows = await db
      .select()
      .from(s.homepageSections)
      .orderBy(asc(s.homepageSections.sortOrder));
  if (entity === "pages")
    rows = await db
      .select()
      .from(s.staticPages)
      .orderBy(asc(s.staticPages.title));
  if (entity === "customers") {
    const q = (p.q ?? "").slice(0, 160);
    const customers = await db.query.customers.findMany({
      where: p.id
        ? eq(s.customers.id, p.id)
        : q
          ? or(
              ilike(s.customers.name, `%${q}%`),
              ilike(s.customers.phone, `%${q}%`),
            )
          : undefined,
      with: {
        orders: { orderBy: desc(s.orders.createdAt), with: { items: true } },
      },
      orderBy: desc(s.customers.createdAt),
    });
    const customer = p.id ? customers.find((c) => c.id === p.id) : undefined;
    if (p.id && !customer) notFound();
    const stats = (c: (typeof customers)[number]) => {
      const delivered = c.orders.filter((o) => o.status === "delivered");
      return {
        orders: c.orders.length,
        delivered: delivered.length,
        cancelled: c.orders.filter((o) => o.status === "cancelled").length,
        spent: delivered.reduce((sum, o) => sum + o.total, 0),
      };
    };
    if (customer) {
      const st = stats(customer);
      const address = customer.defaultAddress;
      return (
        <>
          <PageHeader
            crumbs={[["Customers", "/admin/customers"]]}
            title={
              <span className="admin-title-row">
                {customer.name}
                {customer.isBlocked && (
                  <Tag tone="bad">
                    <Ban size={12} /> Blocked
                  </Tag>
                )}
              </span>
            }
            description={`Customer since ${formatDate(customer.createdAt)}`}
            actions={
              <>
                <a className="admin-btn" href={whatsappHref(customer.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> WhatsApp
                </a>
                <a className="admin-btn primary" href={`tel:${customer.phone}`}>
                  <Phone size={16} /> Call
                </a>
              </>
            }
          />
          <div className="admin-kpis compact">
            {[
              ["Orders", st.orders],
              ["Delivered", st.delivered],
              ["Cancelled", st.cancelled],
              ["Lifetime spend", formatMoney(st.spent)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="admin-kpi static"
                data-tone={label === "Cancelled" && Number(value) > 0 ? "bad" : undefined}
              >
                <span className="admin-kpi-label">{label}</span>
                <strong className="admin-kpi-value">{value}</strong>
              </div>
            ))}
          </div>
          <div className="admin-detail-grid">
            <div className="admin-stack">
              <Panel title="Order history" description={`${st.orders} ${st.orders === 1 ? "order" : "orders"}`}>
                <OrderTable rows={customer.orders} empty="No orders yet." emptyHint={null} showCustomer={false} />
              </Panel>
            </div>
            <div className="admin-stack">
              <Panel title="Contact">
                <div className="admin-customer">
                  <Avatar name={customer.name} size="lg" />
                  <div>
                    <strong>{customer.name}</strong>
                    <small className="admin-mono">{customer.phone}</small>
                  </div>
                </div>
                <dl className="admin-meta">
                  {customer.email && (
                    <div>
                      <dt>Email</dt>
                      <dd>{customer.email}</dd>
                    </div>
                  )}
                  {address && (
                    <div>
                      <dt>Default address</dt>
                      <dd>
                        {[address.line1, address.line2, address.area, address.city].filter(Boolean).join(", ")}
                      </dd>
                    </div>
                  )}
                  {customer.tags.length > 0 && (
                    <div>
                      <dt>Tags</dt>
                      <dd className="admin-inline">
                        {customer.tags.map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </Panel>
              <Panel title="Team notes & access">
                <EntityEditor
                  key={customer.updatedAt.toISOString()}
                  entity="customers"
                  initial={JSON.parse(JSON.stringify(customer))}
                  choices={choices}
                />
              </Panel>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <PageHeader title="Customers" description={descriptions.customers} />
        <form className="admin-filters">
          <label className="admin-search-field">
            <Search size={16} aria-hidden />
            <input
              name="q"
              type="search"
              aria-label="Search customers"
              placeholder="Name or phone number"
              defaultValue={q}
            />
          </label>
          <button className="admin-btn dark">Search</button>
          {q && (
            <Link className="admin-btn ghost" href="/admin/customers">
              <X size={14} /> Clear
            </Link>
          )}
        </form>
        <div className="admin-table-card">
          {customers.length ? (
            <table className="admin-table admin-table-cards">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Orders</th>
                  <th className="num">Delivered</th>
                  <th className="num">Cancelled</th>
                  <th className="num">Spent</th>
                  <th>Last order</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const st = stats(c);
                  return (
                    <tr key={c.id} className="admin-row-link">
                      <td>
                        <span className="admin-person">
                          <Avatar name={c.name} size="sm" />
                          <span>
                            <Link href={href(c.id)} className="admin-stretch admin-strong">
                              {c.name}
                            </Link>
                            <small className="admin-mono">{c.phone}</small>
                          </span>
                        </span>
                      </td>
                      <td className="num" data-label="Orders">{st.orders}</td>
                      <td className="num" data-label="Delivered">{st.delivered}</td>
                      <td className="num" data-label="Cancelled">
                        {st.cancelled > 0 ? <Tag tone={st.cancelled >= 2 ? "bad" : "warn"}>{st.cancelled}</Tag> : 0}
                      </td>
                      <td className="num admin-strong" data-label="Spent">{formatMoney(st.spent)}</td>
                      <td data-label="Last order">{c.orders[0] ? formatDate(c.orders[0].createdAt) : "—"}</td>
                      <td data-label="Status">
                        {c.isBlocked ? <Tag tone="bad">Blocked</Tag> : <Tag tone="good">Active</Tag>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<Users size={22} />} title={q ? `No customers match “${q}”` : "No customers yet"}>
              Customers are created automatically when they place an order.
            </EmptyState>
          )}
        </div>
      </>
    );
  }
  const selected =
    p.id && p.id !== "new" ? rows.find((r) => r.id === p.id) : undefined;
  if (p.id && p.id !== "new" && !selected) notFound();
  const listTitle = section === "taxonomy" ? "Taxonomy" : titles[section];
  const tabs =
    section === "taxonomy" ? (
      <LinkTabs
        label="Taxonomy"
        tabs={[
          { href: "/admin/taxonomy", label: "Notes", current: entity === "notes" },
          { href: "/admin/taxonomy?tab=collections", label: "Collections", current: entity === "collections" },
        ]}
      />
    ) : section === "banners" ? (
      <LinkTabs
        label="Placement"
        tabs={["all", ...s.bannerPlacement.enumValues].map((v) => ({
          href: `/admin/banners?placement=${v}`,
          label: v === "all" ? "All" : placementLabels[v],
          count: v === "all" ? rows.length : rows.filter((r) => r.placement === v).length,
          current: (p.placement ?? "all") === v,
        }))}
      />
    ) : null;
  if (p.id) {
    const name = selected ? String(selected.name ?? selected.title ?? humanize(String(selected.type ?? selected.placement))) : `New ${singular[entity]}`;
    const publicHref =
      selected && typeof selected.slug === "string"
        ? { brands: `/brands/${selected.slug}`, collections: `/c/${selected.slug}`, pages: `/pages/${selected.slug}` }[entity as string]
        : entity === "homepage" || entity === "banners"
          ? "/"
          : undefined;
    return (
      <>
        <PageHeader
          crumbs={[[section === "taxonomy" ? (entity === "notes" ? "Notes" : "Collections") : titles[section], base]]}
          title={name}
          description={selected && typeof selected.updatedAt !== "undefined" ? `Last updated ${formatDate(new Date(String(selected.updatedAt)))}` : `Create a ${singular[entity]}.`}
          actions={
            publicHref && (
              <a className="admin-btn ghost" href={publicHref} target="_blank" rel="noreferrer">
                View on store <ArrowUpRight size={15} />
              </a>
            )
          }
        />
        <div className="admin-form-page">
          <Panel>
            <EntityEditor
              key={
                String(selected?.id ?? "new") +
                String(selected?.updatedAt ?? "")
              }
              entity={entity}
              initial={
                selected ? JSON.parse(JSON.stringify(selected)) : undefined
              }
              choices={choices}
            />
          </Panel>
        </div>
      </>
    );
  }
  const visible =
    entity === "banners" && p.placement && p.placement !== "all"
      ? rows.filter((r) => r.placement === p.placement)
      : rows;
  const header = (
    <PageHeader
      title={listTitle}
      description={descriptions[entity]}
      actions={
        <>
          {["homepage", "banners"].includes(section) && (
            <a className="admin-btn ghost" href="/" target="_blank" rel="noreferrer">
              Preview store <ArrowUpRight size={15} />
            </a>
          )}
          <Link className="admin-btn primary" href={href("new")}>
            <Plus size={16} /> New {singular[entity]}
          </Link>
        </>
      }
    />
  );
  const empty = (icon: ReactNode) => (
    <div className="admin-table-card">
      <EmptyState
        icon={icon}
        title={`No ${entity === "homepage" ? "sections" : entity} yet`}
        action={
          <Link className="admin-btn primary" href={href("new")}>
            <Plus size={16} /> New {singular[entity]}
          </Link>
        }
      />
    </div>
  );
  if (entity === "notes") {
    const groups = [...new Set(rows.map((r) => String(r.group)))];
    return (
      <>
        {header}
        {tabs}
        {rows.length ? (
          <div className="admin-note-groups">
            {groups.map((g) => {
              const inGroup = rows.filter((r) => r.group === g);
              return (
                <Panel key={g} title={humanize(g)} description={`${inGroup.length} notes`} className="admin-note-group">
                  <div className="admin-chips">
                    {inGroup.map((r) => (
                      <Link key={String(r.id)} href={href(String(r.id))} className="admin-chip link">
                        {String(r.name)}
                      </Link>
                    ))}
                  </div>
                </Panel>
              );
            })}
          </div>
        ) : (
          empty(<Layers size={22} />)
        )}
      </>
    );
  }
  if (entity === "collections")
    return (
      <>
        {header}
        {tabs}
        {rows.length ? (
          <div className="admin-tiles">
            {rows.map((r) => {
              const filters = Object.entries((r.filterJson ?? {}) as Record<string, unknown>).filter(([, v]) =>
                Array.isArray(v) ? v.length : v !== undefined && v !== "" && v !== false,
              );
              return (
                <article key={String(r.id)} className="admin-tile">
                  <div className="admin-tile-media">
                    {typeof r.heroImageUrl === "string" && r.heroImageUrl && (
                      <Image unoptimized fill sizes="360px" src={r.heroImageUrl} alt="" />
                    )}
                    <Tag tone={r.isActive ? "good" : "neutral"}>{r.isActive ? "Live" : "Hidden"}</Tag>
                  </div>
                  <div className="admin-tile-body">
                    <Link href={href(String(r.id))} className="admin-stretch admin-strong">
                      {String(r.name)}
                    </Link>
                    <small>/c/{String(r.slug)}</small>
                    <span className="admin-tile-meta">
                      {filters.length ? `${filters.length} filter ${filters.length === 1 ? "rule" : "rules"}` : "No filters, shows every product"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          empty(<Layers size={22} />)
        )}
      </>
    );
  if (entity === "homepage" || entity === "banners")
    return (
      <>
        {header}
        {tabs}
        {visible.length ? (
          <Sortable
            key={JSON.stringify(
              visible.map((r) => [r.id, r.sortOrder, r.isActive, r.title]),
            )}
            entity={entity}
            rows={visible.map((r) => {
              const schedule = [r.startsAt, r.endsAt].some(Boolean)
                ? `${r.startsAt ? formatDate(new Date(String(r.startsAt))) : "Now"} → ${r.endsAt ? formatDate(new Date(String(r.endsAt))) : "no end"}`
                : undefined;
              return {
                id: String(r.id),
                title: String(r.title || humanize(String(r.type ?? r.placement))),
                meta:
                  entity === "banners"
                    ? [placementLabels[String(r.placement)], schedule ?? "Always on"].join(" · ")
                    : [humanize(String(r.type)), r.subtitle].filter(Boolean).join(" · "),
                image: entity === "banners" ? ((r.imageUrl as string | null) ?? null) : undefined,
                isActive: Boolean(r.isActive),
              };
            })}
          />
        ) : (
          empty(entity === "banners" ? <Megaphone size={22} /> : <LayoutTemplate size={22} />)
        )}
      </>
    );
  if (entity === "brands") {
    const productCounts = await db
      .select({ brandId: s.products.brandId, count: count() })
      .from(s.products)
      .groupBy(s.products.brandId);
    return (
      <>
        {header}
        {rows.length ? (
          <div className="admin-table-card">
            <table className="admin-table admin-table-cards">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Type</th>
                  <th className="num">Products</th>
                  <th>Homepage</th>
                  <th className="num">Sort</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="admin-row-link">
                    <td>
                      <span className="admin-product-cell">
                        <span className="admin-thumb logo">
                          {typeof r.logoUrl === "string" && r.logoUrl && (
                            <Image unoptimized fill sizes="48px" src={r.logoUrl} alt="" />
                          )}
                        </span>
                        <span>
                          <Link href={href(String(r.id))} className="admin-stretch admin-strong">
                            {String(r.name)}
                          </Link>
                          <small>/brands/{String(r.slug)}</small>
                        </span>
                      </span>
                    </td>
                    <td data-label="Type">
                      <Tag>{humanize(String(r.brandType))}</Tag>
                    </td>
                    <td className="num" data-label="Products">
                      {productCounts.find((c) => c.brandId === r.id)?.count ?? 0}
                    </td>
                    <td data-label="Homepage">
                      {r.isFeatured ? (
                        <Tag tone="info">
                          <Star size={12} /> Featured
                        </Tag>
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td className="num admin-muted" data-label="Sort">{String(r.sortOrder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          empty(<TagIcon size={22} />)
        )}
      </>
    );
  }
  return (
    <>
      {header}
      {rows.length ? (
        <div className="admin-table-card">
          <table className="admin-table admin-table-cards">
            <thead>
              <tr>
                <th>Page</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} className="admin-row-link">
                  <td>
                    <span className="admin-product-cell">
                      <span className="admin-icon-tile sm">
                        <FileText size={15} />
                      </span>
                      <span>
                        <Link href={href(String(r.id))} className="admin-stretch admin-strong">
                          {String(r.title)}
                        </Link>
                        <small>/pages/{String(r.slug)}</small>
                      </span>
                    </span>
                  </td>
                  <td data-label="Status">
                    <Tag tone={r.isActive ? "good" : "neutral"}>{r.isActive ? "Published" : "Hidden"}</Tag>
                  </td>
                  <td data-label="Updated">{formatDate(new Date(String(r.updatedAt)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        empty(<FileText size={22} />)
      )}
    </>
  );
}
