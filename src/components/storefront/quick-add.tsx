"use client";
import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { LoaderCircle } from "lucide-react";
import { useCart } from "./cart-provider";

/**
 * Card shortcut: adds the size the card shows, qty 1, and opens the bag.
 * A round icon at rest; widens (clip-path, see `.quick-add`) to name the size.
 */
export function QuickAdd({
  variantId,
  price,
  name,
  size,
}: {
  variantId: string;
  price: number;
  name: string;
  size: string;
}) {
  const cart = useCart();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="quick-add"
      aria-label={`Add ${name}, ${size} to bag`}
      disabled={!cart.ready || cart.busy}
      onClick={async () => {
        setPending(true);
        try {
          await cart.add({ variantId, qty: 1, price });
        } finally {
          setPending(false);
        }
      }}
    >
      <span className="quick-add-label" aria-hidden>
        Add {size}
      </span>
      <span className="quick-add-icon" aria-hidden>
        {pending ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} weight="bold" />}
      </span>
    </button>
  );
}
