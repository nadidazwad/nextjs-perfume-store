"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import type { Suggestions } from "@/lib/catalog/query";
import { formatMoney } from "@/lib/money";
import { storeConfig } from "../../../store.config";
import { Media } from "./media";

type Option = { id: string; href: string; label: string };
const cache = new Map<string, Suggestions>();

/** Bold the first case-insensitive match of the query. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * Header search with an accessible autosuggest dropdown (WAI-ARIA combobox,
 * list autocomplete). Works as a plain GET form to /search without JavaScript.
 */
export function SearchForm({ className = "", autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const uid = useId();
  const inputId = `search-${className || "form"}-${uid}`;
  const listId = `${inputId}-list`;
  const root = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState("");
  const [data, setData] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const term = value.trim();

  // Close whenever navigation lands somewhere new.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
    setActive(-1);
  }

  useEffect(() => {
    if (term.length < 2) return;
    const key = term.toLowerCase();
    const hit = cache.get(key);
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (hit) {
          setData(hit);
          setActive(-1);
          return;
        }
        setLoading(true);
        try {
          const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal });
          if (!response.ok) throw new Error();
          const next = (await response.json()) as Suggestions;
          if (cache.size > 50) cache.delete(cache.keys().next().value!);
          cache.set(key, next);
          setData(next);
          setActive(-1);
        } catch {
          if (!controller.signal.aborted) setData(null);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      hit ? 0 : 150,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const show = open && term.length >= 2 && data !== null;
  const options: Option[] = show
    ? [
        ...data.products.map((p) => ({ id: `${listId}-p-${p.slug}`, href: `/products/${p.slug}`, label: `${p.brand} ${p.name}` })),
        ...data.brands.map((b) => ({ id: `${listId}-b-${b.slug}`, href: `/brands/${b.slug}`, label: b.name })),
        { id: `${listId}-all`, href: `/search?q=${encodeURIComponent(term)}`, label: `See all results for ${term}` },
      ]
    : [];
  const current = active >= 0 ? options[active] : undefined;
  const optionProps = (option: Option, index: number) => ({
    id: option.id,
    href: option.href,
    role: "option" as const,
    tabIndex: -1,
    "aria-selected": index === active,
    "data-active": index === active || undefined,
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onMouseMove: () => setActive(index),
    onClick: () => setOpen(false),
  });
  const count = show ? data.products.length + data.brands.length : 0;

  return (
    <form
      ref={root}
      action="/search"
      role="search"
      className={`search-form ${className}`}
      onSubmit={() => setOpen(false)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {loading && show ? <LoaderCircle size={17} className="spin" aria-hidden /> : <Search size={17} aria-hidden />}
      <label className="sr-only" htmlFor={inputId}>
        Search fragrances
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        placeholder="Search fragrances, brands or notes"
        maxLength={160}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={show && current ? current.id : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => term.length >= 2 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!show) {
              if (term.length >= 2) setOpen(true);
              return;
            }
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            // -1 returns focus to the typed text, like native autocomplete.
            setActive((i) => {
              const next = i + step;
              return next < -1 ? options.length - 1 : next >= options.length ? -1 : next;
            });
          } else if (e.key === "Enter" && show && current) {
            e.preventDefault();
            setOpen(false);
            router.push(current.href);
          } else if (e.key === "Escape") {
            if (show) {
              e.preventDefault();
              setOpen(false);
              setActive(-1);
            } else if (value) {
              e.preventDefault();
              setValue("");
            }
          } else if (e.key === "Tab") setOpen(false);
        }}
      />
      <div className="suggest-panel" id={listId} role="listbox" aria-label="Search suggestions" hidden={!show}>
        {show && (
          <>
            {data.products.length > 0 && (
              <div role="group" aria-labelledby={`${listId}-products`}>
                <p className="suggest-label" id={`${listId}-products`} role="presentation">
                  Fragrances
                </p>
                {data.products.map((p, i) => (
                  <Link key={p.slug} className="suggest-product" {...optionProps(options[i], i)}>
                    <Media src={p.image} alt="" sizes="48px" />
                    <span className="suggest-copy">
                      <small>{p.brand}</small>
                      <span>
                        <Highlight text={p.name} query={term} />
                      </span>
                    </span>
                    <span className="suggest-price">
                      <strong>{formatMoney(p.price)}</strong>
                      {storeConfig.features.dealBadges && p.retailPrice > p.price && <del>{formatMoney(p.retailPrice)}</del>}
                      {!p.hasStock && <small>Sold out</small>}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {data.brands.length > 0 && (
              <div role="group" aria-labelledby={`${listId}-brands`}>
                <p className="suggest-label" id={`${listId}-brands`} role="presentation">
                  Brands
                </p>
                {data.brands.map((b, j) => {
                  const i = data.products.length + j;
                  return (
                    <Link key={b.slug} className="suggest-brand" {...optionProps(options[i], i)}>
                      <Media src={b.logoUrl} alt="" sizes="32px" />
                      <span>
                        <Highlight text={b.name} query={term} />
                      </span>
                      <ArrowRight size={15} aria-hidden />
                    </Link>
                  );
                })}
              </div>
            )}
            {count === 0 && (
              <p className="suggest-empty" role="presentation">
                No quick matches for “{term}”.
              </p>
            )}
            <Link className="suggest-all" {...optionProps(options[options.length - 1], options.length - 1)}>
              {count === 0 ? "Search the full catalog" : `See all ${data.total} ${data.total === 1 ? "result" : "results"}`}
              <ArrowRight size={15} aria-hidden />
            </Link>
          </>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {show ? (count ? `${count} suggestions. Use up and down arrows to browse.` : "No suggestions.") : ""}
      </p>
    </form>
  );
}
