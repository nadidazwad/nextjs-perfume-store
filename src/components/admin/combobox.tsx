"use client";
import { useId, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
export type ComboOption = { value: string; label: string; hint?: string };
/**
 * Type-to-filter listbox. With `value` it behaves like a select; without it
 * (add mode) the input clears after each pick so several can be added quickly.
 */
export function Combobox({
  label,
  options,
  value,
  onSelect,
  placeholder = "Search…",
  hideLabel,
}: {
  label: string;
  options: ComboOption[];
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);
  const matches = options
    .filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 50);
  function pick(option?: ComboOption) {
    if (!option) return;
    onSelect(option.value);
    setQuery("");
    setOpen(false);
  }
  return (
    <div className="admin-combo" data-open={open || undefined}>
      <label htmlFor={id} className={hideLabel ? "admin-sr-only" : undefined}>
        {label}
      </label>
      <div className="admin-combo-input">
        <Search size={15} aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          value={open ? query : (selected?.label ?? "")}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(matches.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              pick(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ChevronDown size={15} aria-hidden className="admin-combo-caret" />
      </div>
      {open && (
        <ul className="admin-combo-list" role="listbox" id={`${id}-list`} aria-label={label}>
          {matches.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              <span>
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </span>
              {o.value === value && <Check size={14} />}
            </li>
          ))}
          {!matches.length && <li className="admin-combo-empty">No matches for “{query}”</li>}
        </ul>
      )}
    </div>
  );
}
