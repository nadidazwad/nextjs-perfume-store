import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog/query";
import { formatMoney, calcDiscountPercent } from "@/lib/money";
import { label } from "@/lib/catalog/labels";
import { storeConfig } from "../../../store.config";
import { Media } from "./media";
import { WishlistButton } from "./wishlist-button";
import { Stars } from "./ui";
export function ProductCard({
  product: p,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const v = p.variant;
  const discount = calcDiscountPercent(v.retailPrice, v.price);
  const low =
    p.hasStock &&
    v.stockQuantity > 0 &&
    v.stockQuantity <= (v.lowStockOverride ?? storeConfig.catalog.lowStockThreshold);
  return (
    <article className="product-card" data-soldout={!p.hasStock || undefined}>
      <Link href={`/products/${p.slug}`} className="product-card-link">
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
          <span className="product-card-badges">
            {storeConfig.features.dealBadges && discount > 0 && (
              <span className="badge deal">−{discount}%</span>
            )}
          </span>
          {!p.hasStock && <span className="badge soldout-badge">Sold out</span>}
        </div>
        <div className="product-card-body">
          <p className="product-card-brand">{p.brand.name}</p>
          <h3 className="product-card-name">{p.name}</h3>
          <p className="product-card-meta">
            {label(p.concentration)} · {v.sizeLabel ?? `${v.sizeMl} ml`}
          </p>
          {p.rating && p.rating.count > 0 && (
            <p className="product-card-rating">
              <Stars value={p.rating.average} size={12} />
              <span>
                {p.rating.average.toFixed(1)} <span className="muted">({p.rating.count})</span>
                <span className="sr-only"> {p.rating.count === 1 ? "review" : "reviews"}</span>
              </span>
            </p>
          )}
          <p className="product-card-price">
            <strong>{formatMoney(v.price)}</strong>
            {storeConfig.features.dealBadges && v.retailPrice > v.price && <del>{formatMoney(v.retailPrice)}</del>}
            {low && <span className="stock-hint">Few left</span>}
          </p>
        </div>
      </Link>
      {storeConfig.features.wishlist && <WishlistButton id={p.id} name={p.name} />}
    </article>
  );
}
