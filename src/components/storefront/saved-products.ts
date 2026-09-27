"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ProductCardData } from "@/lib/catalog/query";
import { loadSavedProducts } from "@/lib/catalog/actions";

/** Browser-only lists of product IDs. Nothing is written to the server. */
const lists = {
  wishlist: { key: "attar-wishlist-v1", event: "attar-wishlist", max: 100 },
  recent: { key: "attar-recent-v1", event: "attar-recent", max: 10 },
} as const;
export type SavedKind = keyof typeof lists;

function raw(kind: SavedKind) {
  try {
    return localStorage.getItem(lists[kind].key) ?? "[]";
  } catch {
    return "[]";
  }
}
function parse(value: string): string[] {
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))]
      : [];
  } catch {
    return [];
  }
}
export function readIds(kind: SavedKind) {
  return parse(raw(kind));
}
export function writeIds(kind: SavedKind, ids: string[]) {
  try {
    localStorage.setItem(lists[kind].key, JSON.stringify(ids.slice(0, lists[kind].max)));
    window.dispatchEvent(new Event(lists[kind].event));
  } catch {
    /* Storage blocked or full: browsing still works. */
  }
}
export function useSavedIds(kind: SavedKind) {
  const value = useSyncExternalStore(
    (callback) => {
      const onStorage = (e: StorageEvent) => {
        if (e.key === lists[kind].key || e.key === null) callback();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(lists[kind].event, callback);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(lists[kind].event, callback);
      };
    },
    () => raw(kind),
    () => "[]",
  );
  return useMemo(() => parse(value), [value]);
}
export function toggleWishlist(id: string) {
  const ids = readIds("wishlist");
  writeIds("wishlist", ids.includes(id) ? ids.filter((v) => v !== id) : [id, ...ids]);
}
/** Most recent first, deduplicated, capped at 10. */
export function recordView(id: string) {
  writeIds("recent", [id, ...readIds("recent").filter((v) => v !== id)]);
}

/**
 * Server-rendered card data for a list of saved IDs. Only IDs not yet fetched
 * are requested, so removing an item never refetches the rest. IDs whose
 * products were removed or hidden are pruned from storage.
 */
export function useSavedCards(kind: SavedKind, ids: string[], enabled = true) {
  const [cards, setCards] = useState<Map<string, ProductCardData>>(() => new Map());
  const [attempted, setAttempted] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState(false);
  const missing = useMemo(() => ids.filter((id) => !attempted.has(id)), [ids, attempted]);
  const key = missing.join(",");
  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    const request = key.split(",");
    loadSavedProducts(kind, request)
      .then((result) => {
        if (cancelled) return;
        if (!result.items) {
          setError(true);
          return;
        }
        setError(false);
        setCards((current) => {
          const next = new Map(current);
          for (const card of result.items) next.set(card.id, card);
          return next;
        });
        setAttempted((current) => new Set([...current, ...request]));
        const found = new Set(result.items.map((c) => c.id));
        const gone = request.filter((id) => !found.has(id));
        if (gone.length) writeIds(kind, readIds(kind).filter((id) => !gone.includes(id)));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, key, enabled]);
  const items = ids.flatMap((id) => cards.get(id) ?? []);
  return { items, loading: enabled && missing.length > 0 && !error, error };
}
