"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, X } from "@phosphor-icons/react";
import { LoaderCircle, TicketPercent } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { useCart } from "./cart-provider";
import { Media } from "./media";
import { CountBadge } from "./count-badge";
import { formatMoney } from "@/lib/money";
import { describeCoupon } from "@/lib/coupons/rules";
import { storeConfig } from "../../../store.config";
export function CartFeedback() {
  const cart = useCart();
  return (
    <div aria-live="polite">
      {cart.error && (
        <p className="form-error" role="alert">
          {cart.error}{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => void cart.refresh()}
            disabled={cart.busy}
          >
            Try again
          </button>
        </p>
      )}
      {cart.messages.map((message) => (
        <p key={message} className="cart-notice">
          {message}
        </p>
      ))}
    </div>
  );
}
export function DeliveryProgress() {
  const { subtotal: gross, discount } = useCart();
  const subtotal = gross - discount;
  const threshold = storeConfig.checkout.freeDeliveryOver;
  if (threshold === null) return null;
  const reached = Math.min(subtotal, threshold);
  return (
    <div className="delivery-progress">
      <p>
        {subtotal >= threshold
          ? "Your order qualifies for free delivery."
          : `${formatMoney(threshold - subtotal)} away from free delivery`}
      </p>
      <div
        className="delivery-track"
        role="progressbar"
        aria-label="Progress toward free delivery"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={reached}
        aria-valuetext={formatMoney(reached)}
      >
        <div
          className="delivery-fill"
          style={{ transform: `scaleX(${threshold > 0 ? reached / threshold : 1})` }}
        />
      </div>
    </div>
  );
}
export function CartLines() {
  const cart = useCart();
  return (
    <ul className="cart-lines" aria-busy={cart.busy}>
      {cart.items.map((item) => (
        <li key={item.variantId} className="cart-line">
          <Link
            href={`/products/${item.slug}`}
            onClick={() => cart.setOpen(false)}
            className="cart-image"
          >
            <Media
              src={item.image}
              alt={`${item.brand} ${item.name}`}
              sizes="96px"
            />
          </Link>
          <div className="cart-line-copy">
            <p className="muted">{item.brand}</p>
            <Link
              href={`/products/${item.slug}`}
              onClick={() => cart.setOpen(false)}
            >
              {item.name}
            </Link>
            <p className="muted">
              {item.label} · {formatMoney(item.price)} each
            </p>
            <div className="cart-line-actions">
              <div className="quantity-control">
                <button
                  type="button"
                  aria-label={`Decrease ${item.name} quantity`}
                  disabled={cart.busy || item.qty <= 1}
                  onClick={() => void cart.change(item.variantId, item.qty - 1)}
                >
                  <Minus size={16} />
                </button>
                <output aria-label={`${item.name} quantity`}>{item.qty}</output>
                <button
                  type="button"
                  aria-label={`Increase ${item.name} quantity`}
                  disabled={cart.busy || item.qty >= Math.min(item.stock, 999)}
                  onClick={() => void cart.change(item.variantId, item.qty + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                type="button"
                className="text-link remove-line"
                disabled={cart.busy}
                onClick={() => void cart.change(item.variantId, 0)}
              >
                Remove<span className="sr-only"> {item.name}</span>
              </button>
            </div>
          </div>
          <span className="cart-line-total">
            {formatMoney(item.price * item.qty)}
          </span>
        </li>
      ))}
    </ul>
  );
}
export function CartLoading() {
  return (
    <div aria-label="Loading your bag" role="status" className="cart-loading">
      <div />
      <div />
      <div />
      <span className="sr-only">Loading your bag</span>
    </div>
  );
}
export function EmptyCart() {
  const cart = useCart();
  return (
    <div className="empty-cart">
      <ShoppingBag size={36} weight="light" />
      <h2>Your bag is empty</h2>
      <p className="muted">Find a fragrance you want to wear.</p>
      <Link
        href="/products"
        className="button primary"
        onClick={() => cart.setOpen(false)}
      >
        Browse fragrances
      </Link>
    </div>
  );
}
export function CartSummary({ coupon = true }: { coupon?: boolean }) {
  const cart = useCart();
  return (
    <div className="cart-summary">
      {coupon && <CouponForm />}
      <dl className="checkout-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(cart.subtotal)}</dd>
        </div>
        {cart.coupon && (
          <>
            <div className="coupon-line">
              <dt>Coupon {cart.coupon.code}</dt>
              <dd>−{formatMoney(cart.discount)}</dd>
            </div>
            <div className="after-coupon">
              <dt>After coupon</dt>
              <dd>{formatMoney(cart.subtotal - cart.discount)}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="muted">Delivery calculated at checkout.</p>
      <DeliveryProgress />
      {cart.error || cart.busy ? (
        <button disabled className="button primary">
          {cart.busy ? "Checking your bag…" : "Check your bag to continue"}
        </button>
      ) : (
        <Link
          href="/checkout"
          className="button primary"
          onClick={() => cart.setOpen(false)}
        >
          Checkout
        </Link>
      )}
    </div>
  );
}
/** Apply / remove a coupon. Renders nothing when features.coupons is off. */
export function CouponForm() {
  const cart = useCart();
  const id = useId();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  if (!storeConfig.features.coupons) return null;
  if (cart.coupon || cart.couponCode)
    return (
      <div className="coupon-applied" data-inactive={!cart.coupon || undefined}>
        <span className="icon-tile sm">
          <TicketPercent size={16} aria-hidden />
        </span>
        <div aria-live="polite">
          <strong>{cart.coupon?.code ?? cart.couponCode}</strong>
          {cart.coupon ? (
            <small>
              {describeCoupon(cart.coupon)} · you save {formatMoney(cart.discount)}
            </small>
          ) : (
            <small className="coupon-hint">{cart.couponError || "Checking this code…"}</small>
          )}
        </div>
        <button
          type="button"
          className="text-link"
          disabled={cart.busy || pending}
          onClick={async () => {
            setPending(true);
            await cart.removeCoupon();
            setPending(false);
            setMessage(null);
          }}
        >
          Remove<span className="sr-only"> coupon {cart.coupon?.code ?? cart.couponCode}</span>
        </button>
      </div>
    );
  const apply = async () => {
    if (pending || !code.trim()) return;
    setPending(true);
    const result = await cart.applyCoupon(code);
    setPending(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setCode("");
  };
  // Not a <form>: at checkout this sits inside the order form, and forms can't nest.
  return (
    <div className="coupon-form">
      <label htmlFor={id}>
        Coupon code
      </label>
      <div className="coupon-field">
        <span className="input-affix">
          <TicketPercent size={16} aria-hidden />
          <input
            id={id}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (message) setMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void apply();
              }
            }}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Enter code"
            aria-invalid={message ? !message.ok : undefined}
            aria-describedby={message ? `${id}-message` : undefined}
          />
        </span>
        <button
          type="button"
          className="button sm"
          disabled={pending || cart.busy || !code.trim()}
          onClick={() => void apply()}
        >
          {pending && <LoaderCircle size={14} className="spin" aria-hidden />}
          Apply
        </button>
      </div>
      {message && (
        <p id={`${id}-message`} role={message.ok ? "status" : "alert"} className={message.ok ? "coupon-ok" : "field-error"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
export function CartDrawer() {
  const cart = useCart();
  return (
    <Sheet open={cart.open} onOpenChange={cart.setOpen}>
      <SheetTrigger
        className="icon-button"
        aria-label={`Shopping bag, ${cart.count} items`}
      >
        <ShoppingBag size={21} />
        <CountBadge value={cart.count} ready={cart.ready} />
      </SheetTrigger>
      <SheetContent className="store-sheet cart-sheet" showCloseButton={false}>
        <div className="cart-sheet-heading">
          <SheetTitle>
            Your bag <span className="muted">{cart.count}</span>
          </SheetTitle>
          <SheetClose className="icon-button" aria-label="Close bag">
            <X size={22} />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Review your items before checkout.
        </SheetDescription>
        <div className="cart-sheet-body">
          <CartFeedback />
          {!cart.ready ? (
            <CartLoading />
          ) : cart.items.length ? (
            <CartLines />
          ) : (
            <EmptyCart />
          )}
        </div>
        {cart.ready && cart.items.length > 0 && (
          <div className="cart-sheet-footer">
            <CartSummary coupon={false} />
            <Link
              href="/cart"
              className="text-link"
              onClick={() => cart.setOpen(false)}
            >
              View bag
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
export function CartPage() {
  const cart = useCart();
  return (
    <div className="store-width commerce-page">
      <div className="commerce-heading">
        <h1>Your bag</h1>
        <Link href="/products" className="text-link">
          Continue shopping
        </Link>
      </div>
      <CartFeedback />
      {!cart.ready ? (
        <CartLoading />
      ) : cart.items.length ? (
        <div className="commerce-grid">
          <CartLines />
          <aside>
            <CartSummary />
          </aside>
        </div>
      ) : (
        <EmptyCart />
      )}
    </div>
  );
}
