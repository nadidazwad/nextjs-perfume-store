"use server";
import { z } from "zod";
import { getCardsByIds, type ProductCardData } from "./query";
import { storeConfig } from "../../../store.config";

const idsSchema = z.array(z.string().min(1).max(100)).max(100);

/** Card data for browser-saved IDs (wishlist, recently viewed). Read-only; respects feature flags. */
export async function loadSavedProducts(
  kind: "wishlist" | "recent",
  ids: unknown,
): Promise<{ items: ProductCardData[] } | { items?: undefined; error: string }> {
  const enabled = kind === "wishlist" ? storeConfig.features.wishlist : kind === "recent" ? storeConfig.features.recentlyViewed : false;
  if (!enabled) return { error: "This feature is turned off." };
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { error: "Invalid list." };
  try {
    return { items: await getCardsByIds(parsed.data) };
  } catch {
    return { error: "We couldn't load these products." };
  }
}
