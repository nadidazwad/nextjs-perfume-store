import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProductCardData } from "@/lib/catalog/query";
import { formatMoney, calcDiscountPercent } from "@/lib/money";
import { label } from "@/lib/catalog/labels";
import { storeConfig } from "../../../store.config";
import { Media } from "./media";
import { WishlistButton } from "./wishlist-button";
import { QuickAdd } from "./quick-add";
import { Stars } from "./ui";

/**
 * Product tile: a grey panel holding the photo and a white info plate, in the
 * admin panel's language. The name link stretches over the whole card
 * (`.product-card-link::after`); the heart and quick add sit above it.
 */
export function ProductCard({
  product: p,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const v = p.variant;
  const size = v.sizeLabel ?? `${v.sizeMl} ml`;
  const discount = calcDiscountPercent(v.retailPrice, v.price);
  const low =
    p.hasStock &&
    v.stockQuantity > 0 &&
    v.stockQuantity <= (v.lowStockOverride ?? storeConfig.catalog.lowStockThreshold);
  return (
    <article className="product-card" data-soldout={!p.hasStock || undefined}>
      <div className="product-card-media">
        <Media
          priority={priority}
          src={p.image?.url}
          alt={p.image?.alt ?? p.name}
          sizes="(max-width: 640px) 70vw, (max-width: 1100px) 33vw, 25vw"
        />
        {p.hoverImage && (
          <Media className="hover-image" src={p.hoverImage.url} alt="" sizes="(max-width: 640px) 70vw, 25vw" />
        )}
        {storeConfig.features.dealBadges && discount > 0 && (
          <span className="product-card-badges">
            <span className="badge deal">−{discount}%</span>
          </span>
        )}
        {(!p.hasStock || low) && (
          <span className="stock-flag" data-tone={p.hasStock ? "warn" : "bad"}>
            <i aria-hidden />
            {p.hasStock ? "Few left" : "Sold out"}
          </span>
        )}
        {storeConfig.features.wishlist && <WishlistButton id={p.id} name={p.name} />}
        {v.stockQuantity > 0 && <QuickAdd variantId={v.id} price={v.price} name={p.name} size={size} />}
      </div>
      <div className="product-card-body">
        <p className="product-card-brand">{p.brand.name}</p>
        <h3 className="product-card-name">
          <Link href={`/products/${p.slug}`} className="product-card-link">
            {p.name}
          </Link>
        </h3>
        <ul className="product-card-tags" aria-label="Details">
          <li>{label(p.concentration)}</li>
          <li>{size}</li>
          {p.sizes > 1 && <li>{p.sizes} sizes</li>}
        </ul>
        {p.rating && p.rating.count > 0 && (
          <p className="product-card-rating">
            <Stars value={p.rating.average} size={12} />
            <span>
              {p.rating.average.toFixed(1)} <span className="muted">({p.rating.count})</span>
              <span className="sr-only"> {p.rating.count === 1 ? "review" : "reviews"}</span>
            </span>
          </p>
        )}
        <div className="product-card-foot">
          <p className="product-card-price">
            <strong>{formatMoney(v.price)}</strong>
            {storeConfig.features.dealBadges && v.retailPrice > v.price && <del>{formatMoney(v.retailPrice)}</del>}
          </p>
          <span className="arrow-chip" aria-hidden>
            <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </article>
  );
}
