"use client";
import { useEffect } from "react";
import { ProductCard } from "./product-card";
import { StoreCarousel } from "./carousel";
import { recordView, useSavedCards, useSavedIds, writeIds } from "./saved-products";

/**
 * "Recently viewed" strip (last 10, this device only). On a product page pass
 * currentId: it is recorded and left out of the strip. Renders nothing until
 * there is something to show, so it never shifts an empty page.
 */
export function RecentlyViewed({ currentId }: { currentId?: string }) {
  useEffect(() => {
    if (currentId) recordView(currentId);
  }, [currentId]);
  const ids = useSavedIds("recent").filter((id) => id !== currentId);
  const { items } = useSavedCards("recent", ids);
  if (!items.length) return null;
  return (
    <section className="section recently-viewed" aria-labelledby="recently-viewed-title">
      <div className="section-head">
        <div>
          <h2 id="recently-viewed-title">Recently viewed</h2>
        </div>
        <button type="button" className="button ghost sm" onClick={() => writeIds("recent", currentId ? [currentId] : [])}>
          Clear history
        </button>
      </div>
      <StoreCarousel label="Recently viewed fragrances">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </StoreCarousel>
    </section>
  );
}
