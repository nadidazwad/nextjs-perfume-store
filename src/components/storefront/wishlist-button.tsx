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
      <Heart size={19} weight={saved ? "fill" : "regular"} aria-hidden="true" />
    </button>
  );
}
