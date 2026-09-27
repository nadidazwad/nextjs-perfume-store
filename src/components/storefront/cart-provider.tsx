"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CartLine, CartQuote } from "@/lib/cart/schema";
import { revalidateCart } from "@/lib/cart/actions";
import { storeConfig } from "../../../store.config";
import { isPhone } from "./device";
const KEY = "attar-cart-v1";
const COUPON_KEY = "attar-coupon-v1";
const empty: CartQuote = {
  items: [],
  subtotal: 0,
  messages: [],
  discount: 0,
  coupon: null,
  couponError: "",
};
type CartContextValue = CartQuote & {
  ready: boolean;
  busy: boolean;
  error: string;
  open: boolean;
  count: number;
  setOpen: (open: boolean) => void;
  add: (line: CartLine) => Promise<void>;
  change: (id: string, qty: number) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  /** Code saved in this browser, even when it doesn't currently apply. */
  couponCode: string;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => Promise<void>;
  /** The last successful add; phones confirm it with a toast instead of opening the bag. */
  lastAdded: { id: number; variantId: string } | null;
};
/**
 * Shape check for browser-stored lines, mirroring cartSchema without shipping
 * Zod to every page. Stored prices are dropped; the server re-prices anyway.
 */
function storedLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length > 50) return [];
  const lines: CartLine[] = [];
  for (const item of value) {
    const { variantId, qty } = (item ?? {}) as Record<string, unknown>;
    if (
      typeof variantId !== "string" ||
      !variantId ||
      variantId.length > 100 ||
      !Number.isInteger(qty) ||
      (qty as number) < 1 ||
      (qty as number) > 999 ||
      lines.some((line) => line.variantId === variantId)
    )
      return [];
    lines.push({ variantId, qty: qty as number });
  }
  return lines;
}
const Context = createContext<CartContextValue | null>(null);
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [quote, setQuote] = useState(empty),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  const lines = useRef<CartLine[]>([]),
    revision = useRef(0),
    coupon = useRef("");
  const [couponCode, setCouponCode] = useState("");
  const [lastAdded, setLastAdded] = useState<CartContextValue["lastAdded"]>(null);
  const saveCoupon = useCallback((code: string) => {
    coupon.current = code;
    setCouponCode(code);
    try {
      if (code) localStorage.setItem(COUPON_KEY, code);
      else localStorage.removeItem(COUPON_KEY);
    } catch {
      /* The code still applies for this visit. */
    }
  }, []);
  const locked = useRef(false);
  const persist = useCallback((value: CartLine[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      setError(
        "Your browser couldn't save your bag. Keep this tab open until you order.",
      );
    }
  }, []);
  const update = useCallback(
    async (next: CartLine[], code = coupon.current) => {
      const current = ++revision.current;
      locked.current = true;
      setBusy(true);
      setError("");
      try {
        const result = await revalidateCart(next, code || undefined);
        if (current !== revision.current) return;
        if (!result.quote) {
          setError(result.error ?? "We couldn't check your bag.");
          return result;
        }
        if (result.dropCoupon && code === coupon.current) saveCoupon("");
        lines.current = result.quote.items.map(({ variantId, qty, price }) => ({
          variantId,
          qty,
          price,
        }));
        setQuote(result.quote);
        persist(lines.current);
        return result;
      } catch {
        if (current === revision.current)
          setError("Connection lost. Your bag is saved. Please try again.");
      } finally {
        if (current === revision.current) {
          locked.current = false;
          setBusy(false);
          setReady(true);
        }
      }
    },
    [persist, saveCoupon],
  );
  useEffect(() => {
    const load = () => {
      let stored: CartLine[] = [];
      try {
        stored = storedLines(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
      } catch {
        /* Ignore malformed or old data; never trust stored prices. */
      }
      lines.current = stored;
      let code = "";
      try {
        code = storeConfig.features.coupons
          ? (localStorage.getItem(COUPON_KEY) ?? "").slice(0, 40)
          : "";
      } catch {
        /* Storage blocked: start without a coupon. */
      }
      coupon.current = code;
      setCouponCode(code);
      void update(stored, code);
    };
    load();
    const storage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) load();
    };
    const focus = () => {
      if (!locked.current) void update(lines.current);
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", focus);
    };
  }, [update]);
  const add = async (line: CartLine) => {
    if (locked.current || !ready) return;
    const previous = lines.current.find(
      (item) => item.variantId === line.variantId,
    );
    const next = previous
      ? lines.current.map((item) =>
          item.variantId === line.variantId
            ? { ...line, qty: Math.min(999, item.qty + line.qty) }
            : item,
        )
      : [...lines.current, line];
    // Tablets and desktops open the bag at once; phones stay put and show a toast when it lands.
    const phone = isPhone();
    if (!phone) setOpen(true);
    const result = await update(next);
    if (!phone) return;
    if (result?.quote?.items.some((item) => item.variantId === line.variantId))
      setLastAdded((last) => ({ id: (last?.id ?? 0) + 1, variantId: line.variantId }));
    else setOpen(true); // the bag explains what went wrong
  };
  const change = async (id: string, qty: number) => {
    if (locked.current) return;
    await update(
      lines.current.flatMap((line) =>
        line.variantId === id ? (qty > 0 ? [{ ...line, qty }] : []) : [line],
      ),
    );
  };
  const applyCoupon = async (code: string) => {
    const typed = code.trim();
    if (!typed) return { ok: false, message: "Enter a coupon code." };
    if (locked.current) return { ok: false, message: "Your bag is updating. Try again in a moment." };
    const result = await update(lines.current, typed);
    if (!result?.quote)
      return { ok: false, message: result?.error ?? "Connection lost. Please try again." };
    if (result.quote.coupon) {
      saveCoupon(result.quote.coupon.code);
      return { ok: true, message: `${result.quote.coupon.code} applied.` };
    }
    // Re-quote without the rejected code so the summary matches what was saved.
    const message = result.quote.couponError || "This coupon can't be used.";
    await update(lines.current, coupon.current);
    return { ok: false, message };
  };
  const removeCoupon = async () => {
    saveCoupon("");
    await update(lines.current, "");
  };
  const clear = () => {
    revision.current++;
    locked.current = false;
    lines.current = [];
    persist([]);
    saveCoupon("");
    setQuote(empty);
    setBusy(false);
    setOpen(false);
    setError("");
  };
  return (
    <Context.Provider
      value={{
        ...quote,
        ready,
        busy,
        error,
        open,
        setOpen,
        add,
        change,
        refresh: async () => {
          await update(lines.current);
        },
        clear,
        couponCode,
        applyCoupon,
        removeCoupon,
        lastAdded,
        count: quote.items.reduce((sum, item) => sum + item.qty, 0),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCart() {
  const cart = useContext(Context);
  if (!cart) throw new Error("useCart must be inside CartProvider.");
  return cart;
}
