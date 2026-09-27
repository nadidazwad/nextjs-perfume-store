"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Expand, MessageCircle, Minus, Phone, PhoneCall, Plus, Truck, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProductDetail } from "@/lib/catalog/query";
import { formatMoney, calcDiscountPercent } from "@/lib/money";
import { label } from "@/lib/catalog/labels";
import { storeConfig as config } from "../../../store.config";
import { WishlistButton } from "./wishlist-button";
import { Media } from "./media";
import { Stars } from "./ui";
import { useCart } from "./cart-provider";
const tel = `tel:${config.contact.phone.replace(/\s/g, "")}`;
const paymentNames = Object.entries(config.checkout.paymentMethods)
  .filter(([, method]) => method.enabled)
  .map(([key, method]) => ("label" in method ? method.label : key === "bkash" ? "bKash" : "Nagad"));

export function ProductGallery({
  images,
  name,
}: {
  images: ProductDetail["images"];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const selected = images[index];
  return (
    <div className="product-gallery">
      <Dialog>
        <DialogTrigger className="gallery-main" aria-label={`Enlarge ${name} image`}>
          {images.length ? (
            images.map((image, i) => (
              <div key={image.id} className="gallery-frame" data-selected={index === i} aria-hidden={index !== i}>
                <Media priority={i === 0} src={image.url} alt={image.alt ?? name} sizes="(max-width: 900px) 100vw, 50vw" />
              </div>
            ))
          ) : (
            <Media alt={name} />
          )}
          <span className="gallery-zoom" aria-hidden>
            <Expand size={16} />
          </span>
        </DialogTrigger>
        <DialogContent className="gallery-dialog">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged product image</DialogDescription>
          <Media src={selected?.url} alt={selected?.alt ?? name} sizes="90vw" />
        </DialogContent>
      </Dialog>
      {images.length > 1 && (
        <div className="gallery-thumbnails">
          {images.map((img, i) => (
            <button key={img.id} aria-label={`View image ${i + 1}`} aria-pressed={index === i} onClick={() => setIndex(i)}>
              <Media src={img.url} alt="" sizes="96px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductBuyBox({
  product: p,
  rating,
}: {
  product: ProductDetail;
  /** null when reviews are switched off. */
  rating?: { average: number; count: number } | null;
}) {
  const cart = useCart();
  const [variantId, setVariantId] = useState(
    p.variants.find((v) => v.stockQuantity > 0)?.id ?? p.variants[0]?.id,
  );
  const [quantity, setQuantity] = useState(1);
  // The floating mobile bar appears only once the main button has scrolled away.
  const purchaseRow = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);
  useEffect(() => {
    const row = purchaseRow.current;
    if (!row) return;
    const observer = new IntersectionObserver(([entry]) =>
      setBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, []);
  const v = p.variants.find((v) => v.id === variantId);
  const heading = (
    <>
      <Link href={`/brands/${p.brand.slug}`} className="buy-brand">
        {p.brand.name}
      </Link>
      <h1>{p.name}</h1>
      {rating && (
        <a href="#reviews" className="buy-rating">
          {rating.count ? (
            <>
              <Stars value={rating.average} />
              <span>
                {rating.average.toFixed(1)}
                <span className="muted">
                  {" "}
                  · {rating.count} {rating.count === 1 ? "review" : "reviews"}
                </span>
              </span>
            </>
          ) : (
            <span className="muted">No reviews yet · Write the first</span>
          )}
        </a>
      )}
    </>
  );
  if (!v)
    return (
      <div className="buy-box">
        {heading}
        <p className="callout">No sizes are currently available.</p>
        <Link href="/products" className="button">
          Browse fragrances
        </Link>
      </div>
    );
  const low = v.stockQuantity <= (v.lowStockOverride ?? config.catalog.lowStockThreshold);
  const discount = calcDiscountPercent(v.retailPrice, v.price);
  const soldOut = v.stockQuantity === 0;
  const size = v.sizeLabel ?? `${v.sizeMl} ml`;
  const wa = config.contact.whatsapp
    ? `https://wa.me/${config.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`I'd like to ask about ${p.brand.name} ${p.name}, ${size}.`)}`
    : null;
  const add = () => void cart.add({ variantId: v.id, qty: quantity, price: v.price });
  const disabled = !cart.ready || cart.busy || soldOut;
  return (
    <div className="buy-box">
      {heading}
      <div className="buy-tags">
        <span className="chip">{label(p.concentration)}</span>
        <span className="chip">{label(p.gender)}</span>
        {p.packaging !== "standard" && <span className="chip">{label(p.packaging)}</span>}
      </div>

      <div className="buy-price">
        <strong>{formatMoney(v.price)}</strong>
        {config.features.dealBadges && v.retailPrice > v.price && <del>{formatMoney(v.retailPrice)}</del>}
        {config.features.dealBadges && discount > 0 && <span className="badge deal">Save {discount}%</span>}
      </div>
      <p className="stock-state" data-tone={soldOut ? "bad" : low ? "warn" : "good"}>
        <i aria-hidden />
        {soldOut ? "Out of stock" : low ? `Only ${v.stockQuantity} left` : "In stock"}
      </p>

      {p.variants.length > 1 && (
        <fieldset className="size-picker">
          <legend>
            Size <span>{size}</span>
          </legend>
          <div className="size-options">
            {p.variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                disabled={variant.stockQuantity === 0}
                aria-pressed={variant.id === v.id}
                onClick={() => {
                  setVariantId(variant.id);
                  setQuantity(1);
                }}
              >
                <strong>{variant.sizeLabel ?? `${variant.sizeMl} ml`}</strong>
                <span>{variant.stockQuantity === 0 ? "Sold out" : formatMoney(variant.price)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="purchase-row" ref={purchaseRow}>
        <div className="quantity-control" role="group" aria-label="Quantity">
          <button aria-label="Decrease quantity" disabled={quantity <= 1 || soldOut} onClick={() => setQuantity((q) => q - 1)}>
            <Minus size={15} />
          </button>
          <output aria-live="polite">{quantity}</output>
          <button
            aria-label="Increase quantity"
            disabled={quantity >= Math.min(v.stockQuantity, 999)}
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus size={15} />
          </button>
        </div>
        <button className="button primary lg add-to-bag" disabled={disabled} onClick={add}>
          {soldOut ? "Out of stock" : cart.busy ? "Adding…" : "Add to bag"}
        </button>
        {config.features.wishlist && <WishlistButton id={p.id} name={p.name} />}
      </div>

      <div className="buy-note">
        <span className="icon-tile sm">
          <PhoneCall size={15} aria-hidden />
        </span>
        <p>{config.checkout.confirmationNote}</p>
      </div>

      <div className="buy-panel">
        <div className="buy-panel-row">
          <span className="icon-tile sm">
            <Truck size={15} aria-hidden />
          </span>
          <div>
            <strong>Delivery</strong>
            <ul className="delivery-zones">
              {config.checkout.deliveryZones.map((zone) => (
                <li key={zone.id}>
                  <span>{zone.label}</span>
                  <span>
                    {zone.etaDays} · {formatMoney(zone.fee)}
                  </span>
                </li>
              ))}
            </ul>
            {config.checkout.freeDeliveryOver !== null && (
              <small>Free delivery on orders over {formatMoney(config.checkout.freeDeliveryOver)}.</small>
            )}
            {p.groundShippingOnly && <small>Ships by ground only.</small>}
          </div>
        </div>
        <div className="buy-panel-row">
          <span className="icon-tile sm">
            <Wallet size={15} aria-hidden />
          </span>
          <div>
            <strong>Payment</strong>
            <small>{paymentNames.join(" · ")}</small>
          </div>
        </div>
      </div>

      <div className="buy-help">
        <p>Questions about this fragrance?</p>
        <div>
          <a className="button sm" href={tel}>
            <Phone size={14} aria-hidden /> Call us
          </a>
          {wa && (
            <a className="button sm" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={14} aria-hidden /> WhatsApp
            </a>
          )}
        </div>
      </div>

      <p className="buy-meta">
        <span>SKU {v.sku}</span>
        {v.barcode && <span>Barcode {v.barcode}</span>}
        <Link href="/pages/authenticity" className="text-link">
          Authenticity
        </Link>
      </p>

      <div className="mobile-buy-bar" data-visible={barVisible || undefined} aria-hidden={!barVisible}>
        <div>
          <strong>{formatMoney(v.price)}</strong>
          <span>{size}</span>
        </div>
        <button disabled={disabled} className="button primary" onClick={add} tabIndex={barVisible ? 0 : -1}>
          {soldOut ? "Out of stock" : "Add to bag"}
        </button>
      </div>
    </div>
  );
}
