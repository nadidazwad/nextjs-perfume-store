"use client";
import { useState } from "react";
import { trackOrder } from "@/lib/checkout/actions";
import type { PublicOrder } from "@/lib/orders/public-order";
import { formatMoney } from "@/lib/money";
import { label } from "@/lib/catalog/labels";
export function OrderSummary({ order }: { order: PublicOrder }) {
  return (
    <section className="order-result" aria-label="Order details">
      <div className="order-result-heading">
        <h2>{order.orderNumber}</h2>
        <span>{label(order.status)}</span>
      </div>
      <ol className="order-timeline">
        {order.events.map((event) => (
          <li key={event.id}>
            <strong>{label(event.status ?? "pending")}</strong>
            <time dateTime={event.date}>
              {new Date(event.date).toLocaleString("en-GB", {
                timeZone: "Asia/Dhaka",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </li>
        ))}
      </ol>
      <ul className="checkout-items">
        {order.items.map((item) => (
          <li key={item.id}>
            <span>
              {item.brand} {item.name}
              <small>
                {item.label} · Qty {item.quantity}
              </small>
            </span>
            <span>{formatMoney(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div className="total-row">
        <span>Delivery</span>
        <span>{formatMoney(order.deliveryFee)}</span>
      </div>
      {order.discount > 0 && (
        <div className="total-row">
          <span>{order.couponCode ? `Coupon ${order.couponCode}` : "Discount"}</span>
          <span>−{formatMoney(order.discount)}</span>
        </div>
      )}
      <div className="total-row">
        <strong>Total</strong>
        <strong>{formatMoney(order.total)}</strong>
      </div>
      {order.courier && <p>Courier: {order.courier}</p>}
      {order.trackingId && <p>Tracking ID: {order.trackingId}</p>}
    </section>
  );
}
export function TrackingPage() {
  const [order, setOrder] = useState<PublicOrder | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <div className="store-width commerce-page tracking-page">
      <h1>Track your order</h1>
      <p className="muted">
        Use your order number and the mobile number you ordered with.
      </p>
      <form
        className="tracking-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const values = Object.fromEntries(new FormData(event.currentTarget));
          setPending(true);
          setError("");
          setOrder(null);
          try {
            const result = await trackOrder(values);
            if (result.order) setOrder(result.order);
            else setError(result.error ?? "No matching order.");
          } catch {
            setError("Connection lost. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="checkout-field">
          <label htmlFor="orderNumber">Order number</label>
          <input
            name="orderNumber"
            id="orderNumber"
            required
            maxLength={40}
            autoCapitalize="characters"
          />
        </div>
        <div className="checkout-field">
          <label htmlFor="tracking-phone">Mobile number</label>
          <input
            name="phone"
            id="tracking-phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={30}
          />
        </div>
        <button className="button primary" disabled={pending}>
          {pending ? "Finding your order…" : "Find order"}
        </button>
      </form>
      <div aria-live="polite">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {order && <OrderSummary order={order} />}
      </div>
    </div>
  );
}
