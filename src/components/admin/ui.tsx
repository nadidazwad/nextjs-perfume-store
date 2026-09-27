import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import { STATUS_LABELS, initials } from "@/lib/admin/format";

/** Page title row: "Crumb / Title" on the left, primary actions on the right. */
export function PageHeader({
  crumbs = [],
  title,
  description,
  actions,
  children,
}: {
  crumbs?: [label: string, href: string][];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="admin-page-head">
      <div className="admin-page-title">
        <h1>
          {crumbs.map(([label, href]) => (
            <span className="admin-crumb" key={href}>
              <Link href={href}>{label}</Link>
              <span aria-hidden> / </span>
            </span>
          ))}
          {title}
        </h1>
        {description && <div className="admin-page-desc">{description}</div>}
        {children}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`admin-panel ${className}`} id={id}>
      {(title || actions) && (
        <div className="admin-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="admin-panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="admin-status" data-status={status}>
      <i aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="admin-tag" data-tone={tone}>
      {children}
    </span>
  );
}

/** Deterministic tint so the same customer always gets the same avatar. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span className="admin-avatar" data-size={size} data-tint={hash % 6} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      {icon && <span className="admin-empty-icon">{icon}</span>}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  href,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
  noun: string;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <span>
        {total ? (
          <>
            Showing <strong>{first}–{last}</strong> of <strong>{total}</strong> {noun}
          </>
        ) : (
          `No ${noun}`
        )}
      </span>
      <div>
        {page > 1 ? (
          <Link className="admin-btn icon" href={href(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className="admin-btn icon" aria-disabled>
            <ChevronLeft size={16} />
          </span>
        )}
        {last < total ? (
          <Link className="admin-btn icon" href={href(page + 1)} aria-label="Next page">
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className="admin-btn icon" aria-disabled>
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Link-based segmented tabs (status filters, placements, taxonomy). */
export function LinkTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { href: string; label: ReactNode; count?: number; current: boolean }[];
}) {
  return (
    <nav className="admin-segments" aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.current ? "page" : undefined} scroll={false}>
          {t.label}
          {t.count !== undefined && <span className="admin-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
