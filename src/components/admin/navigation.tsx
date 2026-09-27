"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  FileText,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
  Menu,
  MessageSquareText,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Tag,
  TicketPercent,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Logout } from "./auth-controls";
import { storeConfig } from "../../../store.config";

type NavLink = [route: string, title: string, icon: LucideIcon];
const groups: { label: string; links: NavLink[] }[] = [
  {
    label: "Main menu",
    links: [
      ["", "Overview", LayoutGrid],
      ["orders", "Orders", ShoppingBag],
      ["products", "Products", Package],
      ["customers", "Customers", Users],
    ],
  },
  {
    label: "Catalog",
    links: [
      ["brands", "Brands", Tag],
      ["taxonomy", "Taxonomy", Layers],
    ],
  },
  {
    label: "Storefront",
    links: [
      ["banners", "Banners", Megaphone],
      ["homepage", "Homepage", LayoutTemplate],
      ["pages", "Pages", FileText],
    ],
  },
  {
    // Feature-flagged sections disappear from the menu when switched off.
    label: "Marketing",
    links: [
      ...(storeConfig.features.coupons ? [["coupons", "Coupons", TicketPercent] satisfies NavLink] : []),
      ...(storeConfig.features.reviews ? [["reviews", "Reviews", MessageSquareText] satisfies NavLink] : []),
    ],
  },
  { label: "General", links: [["settings", "Settings", Settings]] },
];

export function AdminShell({
  storeName,
  pending,
  pendingReviews = 0,
  user,
  children,
}: {
  storeName: string;
  pending: number;
  pendingReviews?: number;
  user: { name: string; email: string };
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(path);
  const search = useRef<HTMLInputElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  // Close the drawer whenever navigation lands on a new page.
  if (open && openedAt !== path) {
    setOpen(false);
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      const target = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        search.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (account.current?.open && !account.current.contains(e.target as Node))
        account.current.open = false;
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  useEffect(() => {
    if (account.current) account.current.open = false;
  }, [path]);
  const isCurrent = (route: string) =>
    route ? path === `/admin/${route}` || path.startsWith(`/admin/${route}/`) : path === "/admin";
  return (
    <div className="admin-shell" data-drawer={open ? "open" : undefined}>
      <a className="admin-skip" href="#main">
        Skip to content
      </a>
      <aside className="admin-sidebar" aria-label="Administration">
        <div className="admin-sidebar-top">
          <Link href="/admin" className="admin-wordmark">
            {storeName}
            <sup>©</sup>
          </Link>
          <button
            type="button"
            className="admin-btn icon ghost admin-drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="admin-nav">
          {groups.filter((group) => group.links.length).map((group) => (
            <div key={group.label} className="admin-nav-group">
              <p>{group.label}</p>
              {group.links.map(([route, title, Icon]) => (
                <Link
                  key={route}
                  href={`/admin${route ? `/${route}` : ""}`}
                  aria-current={isCurrent(route) ? "page" : undefined}
                >
                  <span className="admin-nav-icon">
                    <Icon size={17} strokeWidth={1.7} />
                  </span>
                  <span className="admin-nav-label">{title}</span>
                  {route === "orders" && pending > 0 && (
                    <span className="admin-nav-badge" aria-label={`${pending} pending`}>
                      {pending}
                    </span>
                  )}
                  {route === "reviews" && pendingReviews > 0 && (
                    <span className="admin-nav-badge" aria-label={`${pendingReviews} awaiting moderation`}>
                      {pendingReviews}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <a className="admin-store-card" href="/" target="_blank" rel="noreferrer">
          <span>
            <small>Your storefront</small>
            <strong>{storeName}</strong>
          </span>
          <span className="admin-store-card-icon">
            <ArrowUpRight size={16} />
          </span>
        </a>
      </aside>
      <button
        type="button"
        className="admin-scrim"
        aria-label="Close navigation"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
      <div className="admin-frame">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-btn icon admin-menu-btn"
            onClick={() => {
              setOpenedAt(path);
              setOpen(true);
            }}
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu size={18} />
          </button>
          <Link href="/admin" className="admin-wordmark admin-topbar-mark">
            {storeName}
            <sup>©</sup>
          </Link>
          <form
            className="admin-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
              router.push(`/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ""}`);
            }}
          >
            <Search size={16} aria-hidden />
            <input
              ref={search}
              name="q"
              type="search"
              placeholder="Find an order by number, phone or name"
              aria-label="Search orders"
              autoComplete="off"
            />
            <kbd aria-hidden>/</kbd>
          </form>
          <div className="admin-topbar-end">
            <Link
              href="/admin/orders?status=pending"
              className="admin-pending-pill"
              data-active={pending > 0 || undefined}
            >
              <i aria-hidden />
              <span>
                <strong>{pending}</strong> <span className="admin-hide-sm">to call</span>
              </span>
            </Link>
            <details className="admin-user" ref={account}>
              <summary aria-label="Account menu">
                <span className="admin-avatar" data-size="md" data-tint="0" aria-hidden>
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="admin-user-meta">
                  <strong>{user.name || "Admin"}</strong>
                  <small>Store administrator</small>
                </span>
              </summary>
              <div className="admin-user-menu">
                <p>
                  <strong>{user.name || "Admin"}</strong>
                  <small>{user.email}</small>
                </p>
                <a href="/" target="_blank" rel="noreferrer">
                  View storefront <ArrowUpRight size={14} />
                </a>
                <Link href="/admin/settings">Settings & diagnostics</Link>
                <Logout />
              </div>
            </details>
          </div>
        </header>
        <main className="admin-main" id="main">
          {children}
        </main>
        <Toaster position="bottom-center" theme="light" />
      </div>
    </div>
  );
}
