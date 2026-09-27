"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatMoney } from "@/lib/money";
import { ProductCard } from "./product-card";
import { Media } from "./media";
import { CountBadge } from "./count-badge";
import { toggleWishlist, useSavedCards, useSavedIds, writeIds } from "./saved-products";

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="product-grid" role="status" aria-label="Loading your wishlist">
      {Array.from({ length: Math.min(Math.max(count, 1), 8) }, (_, i) => (
        <div key={i} className="card-skeleton">
          <div className="loading-image" />
          <div className="loading-plate">
            <div className="loading-line" />
            <div className="loading-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Two-step "Clear all" so one stray tap doesn't wipe the list. */
function ClearAll({ onClear }: { onClear: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      className={`button sm clear-all${armed ? " primary" : " ghost"}`}
      data-armed={armed || undefined}
      onClick={() => (armed ? onClear() : setArmed(true))}
      aria-live="polite"
    >
      {armed ? "Tap again to clear" : "Clear all"}
    </button>
  );
}

export function WishlistPage() {
  const ids = useSavedIds("wishlist");
  const [ready, setReady] = useState(false);
  // localStorage is only readable after hydration.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const { items, loading, error } = useSavedCards("wishlist", ids, ready);
  const count = ids.length;
  return (
    <>
      <header className="listing-header">
        <div>
          <h1>
            Wishlist {ready && count > 0 && <span className="count-pill">{count}</span>}
          </h1>
          <p className="listing-description">Saved on this device. No account needed.</p>
        </div>
        {count > 0 && <ClearAll onClear={() => writeIds("wishlist", [])} />}
      </header>
      {!ready || (loading && !items.length) ? (
        <GridSkeleton count={count || 4} />
      ) : error && !items.length ? (
        <div className="empty-state" role="alert">
          <h2>We couldn&apos;t load your saved fragrances</h2>
          <p>Check your connection and reload the page. Your list is still saved.</p>
        </div>
      ) : items.length ? (
        <div className="product-grid wishlist-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="icon-tile lg">
            <Heart size={22} aria-hidden />
          </span>
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any fragrance to save it here for later.</p>
          <Link href="/products" className="button primary">
            Browse fragrances
          </Link>
        </div>
      )}
    </>
  );
}

/** Header heart: count badge + a sheet listing saved items. */
export function WishlistSheet() {
  const ids = useSavedIds("wishlist");
  const [open, setOpen] = useState(false);
  const { items, loading } = useSavedCards("wishlist", ids, open);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="icon-button" aria-label={`Wishlist, ${ids.length} ${ids.length === 1 ? "item" : "items"}`}>
        <Heart size={18} aria-hidden />
        <CountBadge value={ids.length} hideZero />
      </SheetTrigger>
      <SheetContent className="store-sheet cart-sheet wishlist-sheet" showCloseButton={false}>
        <div className="cart-sheet-heading">
          <SheetTitle>
            Wishlist <span className="muted">{ids.length}</span>
          </SheetTitle>
          <SheetClose className="icon-button" aria-label="Close wishlist">
            <X size={20} />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">Fragrances you saved on this device.</SheetDescription>
        <div className="cart-sheet-body">
          {!ids.length ? (
            <div className="empty-cart">
              <Heart size={36} strokeWidth={1.25} aria-hidden />
              <h2>Nothing saved yet</h2>
              <p className="muted">Tap the heart on any fragrance to keep it here.</p>
              <Link href="/products" className="button primary" onClick={() => setOpen(false)}>
                Browse fragrances
              </Link>
            </div>
          ) : loading && !items.length ? (
            <div className="cart-loading" role="status" aria-label="Loading your wishlist">
              <div />
              <div />
            </div>
          ) : (
            <ul className="cart-lines">
              {items.map((p) => (
                <li key={p.id} className="cart-line saved-line">
                  <Link href={`/products/${p.slug}`} onClick={() => setOpen(false)} className="cart-image">
                    <Media src={p.image?.url} alt={p.image?.alt ?? p.name} sizes="96px" />
                  </Link>
                  <div className="cart-line-copy">
                    <p className="muted">{p.brand.name}</p>
                    <Link href={`/products/${p.slug}`} onClick={() => setOpen(false)}>
                      {p.name}
                    </Link>
                    <p className="saved-line-price">
                      <strong>{formatMoney(p.variant.price)}</strong>
                      {!p.hasStock && <span className="muted"> · Sold out</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button saved-line-remove"
                    aria-label={`Remove ${p.name} from wishlist`}
                    onClick={() => toggleWishlist(p.id)}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {ids.length > 0 && (
          <div className="cart-sheet-footer">
            <Link href="/wishlist" className="button primary" onClick={() => setOpen(false)}>
              View wishlist
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
