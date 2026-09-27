"use client";
import { Heart } from "@phosphor-icons/react";
import { toggleWishlist, useSavedIds } from "./saved-products";
export function WishlistButton({ id, name }: { id: string; name: string }) {
  const saved = useSavedIds("wishlist").includes(id);
  return (
    <button
      type="button"
      className="icon-button wishlist-button"
      aria-label={`${saved ? "Remove" : "Save"} ${name}${saved ? " from" : " to"} wishlist`}
      aria-pressed={saved}
      onClick={() => toggleWishlist(id)}
    >
      {/* Both states stay mounted so CSS can cross-fade them (storefront.css). */}
      <Heart size={19} className="heart heart-off" aria-hidden="true" />
      <Heart size={19} weight="fill" className="heart heart-on" aria-hidden="true" />
    </button>
  );
}
