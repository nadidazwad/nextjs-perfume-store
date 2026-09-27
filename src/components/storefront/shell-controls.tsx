"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, ChevronDown, Menu, MessageCircle, Phone, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { storeConfig } from "../../../store.config";
import { CartDrawer } from "./cart";
import { WishlistSheet } from "./wishlist";
import { SearchForm } from "./search-suggest";
import { Media } from "./media";
export type NavLink = { name: string; href: string };
const tel = `tel:${storeConfig.contact.phone.replace(/\s/g, "")}`;
const whatsapp = storeConfig.contact.whatsapp
  ? `https://wa.me/${storeConfig.contact.whatsapp.replace(/\D/g, "")}`
  : null;

export { SearchForm };

/** Left-side drawer for phones and tablets. */
export function MobileMenu({ links, brands }: { links: NavLink[]; brands: NavLink[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="icon-button mobile-only" aria-label="Open menu">
        <Menu size={19} />
      </SheetTrigger>
      <SheetContent side="left" className="store-sheet menu-sheet" showCloseButton={false}>
        <div className="menu-sheet-head">
          <SheetTitle className="store-logo">{storeConfig.store.name}</SheetTitle>
          <SheetClose className="icon-button" aria-label="Close menu">
            <X size={18} />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">Shop fragrances by collection or brand</SheetDescription>
        <nav
          aria-label="Mobile navigation"
          className="menu-sheet-nav"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <SearchForm className="menu-search" />
          <Link href="/products" className="button primary lg">
            All fragrances <ArrowUpRight size={17} aria-hidden />
          </Link>
          <p className="menu-label">Shop</p>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="menu-link">
              {link.name}
            </Link>
          ))}
          <details className="menu-brands">
            <summary className="menu-link">
              Brands <ChevronDown size={16} aria-hidden />
            </summary>
            <div>
              <Link href="/brands" className="menu-link sub">
                All brands
              </Link>
              {brands.map((b) => (
                <Link key={b.href} href={b.href} className="menu-link sub">
                  {b.name}
                </Link>
              ))}
            </div>
          </details>
        </nav>
        <div className="menu-sheet-contact">
          <a className="button" href={tel}>
            <Phone size={15} aria-hidden /> {storeConfig.contact.phone}
          </a>
          {whatsapp && (
            <a className="button" href={whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={15} aria-hidden /> WhatsApp
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Right-side icons: search (phones), wishlist, bag. */
export function HeaderActions() {
  return (
    <div className="header-actions">
      <Link className="icon-button mobile-only" href="/search" aria-label="Search fragrances">
        <Search size={18} />
      </Link>
      {storeConfig.features.wishlist && <WishlistSheet />}
      <CartDrawer />
    </div>
  );
}

export function Announcement({
  messages,
}: {
  messages: { title: string | null; href: string | null }[];
}) {
  const announcementRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0),
    [hidden, setHidden] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = !!sessionStorage.getItem("attar-announcement-dismissed");
    } catch {}
    if (dismissed) {
      const timer = setTimeout(() => setHidden(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    if (messages.length < 2 || hidden) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setInterval(() => {
      const element = announcementRef.current;
      if (reduced.matches || document.hidden || element?.contains(document.activeElement) || element?.matches(":hover")) return;
      setIndex((i) => (i + 1) % messages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [messages.length, hidden]);
  if (hidden || !messages.length) return null;
  const message = messages[index % messages.length];
  return (
    <div className="announcement" ref={announcementRef}>
      <div key={index} className="announcement-text">
        {message.href ? <Link href={message.href}>{message.title}</Link> : message.title}
      </div>
      <button
        className="announcement-close"
        aria-label="Dismiss announcement"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem("attar-announcement-dismissed", "1");
          } catch {}
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      className="newsletter"
      onSubmit={(event) => {
        event.preventDefault();
        console.info("Newsletter signup stub");
        setSubmitted(true);
      }}
    >
      <label htmlFor="newsletter">News by email</label>
      <div className="newsletter-field">
        <input id="newsletter" type="email" required placeholder="Your email address" autoComplete="email" />
        <button type="submit" className="button primary sm">
          Subscribe
        </button>
      </div>
      <p>{submitted ? "Thanks. Email subscriptions are not active yet." : "Email subscriptions are coming soon."}</p>
    </form>
  );
}

/** Desktop category row. Highlights the current link and closes menus on outside click / Escape. */
export function DesktopNavigation({ links, children }: { links: NavLink[]; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const path = usePathname();
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node))
        ref.current?.querySelectorAll("details[open]").forEach((el) => el.removeAttribute("open"));
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <nav
      ref={ref}
      aria-label="Main navigation"
      className="desktop-nav store-width"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          ref.current?.querySelectorAll("details[open]").forEach((el) => el.removeAttribute("open"));
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const open = ref.current?.querySelector<HTMLDetailsElement>("details[open]");
          open?.removeAttribute("open");
          open?.querySelector("summary")?.focus();
        }
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a"))
          ref.current?.querySelectorAll("details[open]").forEach((el) => el.removeAttribute("open"));
      }}
    >
      <Link href="/products" className="nav-link" aria-current={path === "/products" ? "page" : undefined}>
        All fragrances
      </Link>
      {children}
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="nav-link" data-accent={link.name === "Deals" || undefined}>
          {link.name}
        </Link>
      ))}
    </nav>
  );
}

export type BrandMenuItem = {
  id: string;
  name: string;
  href: string;
  isFeatured: boolean;
  spotlight?: { name: string; href: string; imageUrl: string };
};

/** Desktop "Brands" dropdown: hovering or focusing a brand swaps in its lead fragrance on the right. */
export function BrandMenu({ brands }: { brands: BrandMenuItem[] }) {
  const withSpotlight = brands.filter((b) => b.spotlight);
  const initial = (withSpotlight.find((b) => b.isFeatured) ?? withSpotlight[0])?.id;
  const [active, setActive] = useState(initial);
  return (
    <div className="nav-panel" onMouseLeave={() => setActive(initial)}>
      <div className="nav-panel-list">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={b.href}
            data-active={b.id === active || undefined}
            onMouseEnter={() => b.spotlight && setActive(b.id)}
            onFocus={() => b.spotlight && setActive(b.id)}
          >
            {b.name}
          </Link>
        ))}
        <Link href="/brands" className="nav-panel-all">
          All brands <ArrowUpRight size={15} aria-hidden />
        </Link>
      </div>
      {withSpotlight.length > 0 && (
        <div className="nav-feature">
          {withSpotlight.map((b) => (
            <Link
              key={b.id}
              href={b.spotlight!.href}
              className="nav-feature-card"
              data-active={b.id === active || undefined}
              inert={b.id !== active}
            >
              <Media src={b.spotlight!.imageUrl} alt="" sizes="360px" />
              <span className="nav-feature-caption">
                <small>{b.name}</small>
                <strong>{b.spotlight!.name}</strong>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
