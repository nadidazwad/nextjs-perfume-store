"use client";
import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { saveEntity, deleteEntity, deactivateBrand } from "@/lib/admin/actions";
import type { ActionResult, Entity } from "@/lib/admin/schema";
import { slugify } from "@/lib/slug";
import { humanize } from "@/lib/admin/format";
import {
  ChipChoice,
  ChipMulti,
  ConfirmButton,
  FieldError,
  ImageField,
  MarkdownField,
  Result,
  SwitchField,
  useUnsavedGuard,
} from "./fields";
type RecordData = Record<string, unknown>;
export type Choices = {
  brands: { id: string; name: string; slug: string }[];
  notes: { id: string; name: string; slug: string; group: string }[];
  collections: { id: string; name: string }[];
  families: string[];
};
type Field = {
  key: string;
  label: string;
  kind?:
    | "number"
    | "checkbox"
    | "image"
    | "markdown"
    | "datetime-local"
    | "textarea";
  options?: string[];
  hint?: string;
  wide?: boolean;
};
const nameFields: Field[] = [
  { key: "name", label: "Name" },
  { key: "slug", label: "URL handle" },
];
const active: Field = { key: "isActive", label: "Visible in store", kind: "checkbox" };
const sort: Field = { key: "sortOrder", label: "Sort order", kind: "number", hint: "Lower numbers show first." };
const fields: Record<Entity, Field[]> = {
  brands: [
    ...nameFields,
    {
      key: "brandType",
      label: "Brand type",
      options: ["designer", "niche", "arabian", "celebrity", "local"],
    },
    { key: "logoUrl", label: "Logo", kind: "image" },
    { key: "heroImageUrl", label: "Hero image", kind: "image" },
    { key: "description", label: "Description", kind: "markdown" },
    { key: "isFeatured", label: "Featured brand", kind: "checkbox", hint: "Shown in the homepage brand strip." },
    sort,
  ],
  notes: [
    ...nameFields,
    {
      key: "group",
      label: "Note group",
      options: [
        "citrus",
        "floral",
        "woody",
        "oriental",
        "fresh",
        "spicy",
        "sweet",
        "musky",
        "green",
        "aquatic",
      ],
    },
  ],
  collections: [
    ...nameFields,
    { key: "heroImageUrl", label: "Hero image", kind: "image" },
    { key: "description", label: "Description", kind: "markdown" },
    active,
    sort,
  ],
  banners: [
    {
      key: "placement",
      label: "Placement",
      options: ["announcement", "hero", "event_card", "promo_strip"],
    },
    { key: "title", label: "Title" },
    { key: "subtitle", label: "Subtitle" },
    { key: "imageUrl", label: "Image", kind: "image" },
    { key: "href", label: "Link", hint: "A path like /products?deal=true or a full URL." },
    { key: "ctaLabel", label: "Button text" },
    {
      key: "startsAt",
      label: "Starts",
      kind: "datetime-local",
      hint: "Your local time. Leave empty to start now.",
    },
    {
      key: "endsAt",
      label: "Ends",
      kind: "datetime-local",
      hint: "Leave empty to run indefinitely.",
    },
    active,
    sort,
  ],
  homepage: [
    {
      key: "type",
      label: "Section type",
      options: [
        "hero",
        "category_tiles",
        "event_cards",
        "product_carousel",
        "brand_strip",
        "value_props",
        "collection_banner",
      ],
    },
    { key: "title", label: "Title" },
    { key: "subtitle", label: "Subtitle" },
    active,
    sort,
  ],
  pages: [
    { key: "title", label: "Title" },
    { key: "slug", label: "URL handle" },
    { key: "body", label: "Page content", kind: "markdown" },
    active,
  ],
  customers: [
    { key: "internalNote", label: "Internal note", kind: "textarea", hint: "Only visible to your team." },
    { key: "tags", label: "Tags", hint: "Separate with commas, e.g. vip, wholesale.", wide: true },
    {
      key: "isBlocked",
      label: "Block checkout",
      kind: "checkbox",
      hint: "Their checkouts are refused with a polite request to call the store.",
    },
  ],
};
const defaults: Record<Entity, RecordData> = {
  brands: {
    name: "",
    slug: "",
    brandType: "local",
    logoUrl: null,
    heroImageUrl: null,
    description: "",
    isFeatured: false,
    sortOrder: 0,
  },
  notes: { name: "", slug: "", group: "fresh" },
  collections: {
    name: "",
    slug: "",
    description: "",
    heroImageUrl: null,
    filterJson: {},
    isActive: true,
    sortOrder: 0,
  },
  banners: {
    placement: "hero",
    title: "",
    subtitle: "",
    imageUrl: null,
    href: null,
    ctaLabel: "",
    startsAt: null,
    endsAt: null,
    isActive: true,
    sortOrder: 0,
  },
  homepage: {
    type: "product_carousel",
    title: "",
    subtitle: "",
    config: { source: "featured", limit: 8 },
    isActive: true,
    sortOrder: 0,
  },
  pages: { slug: "", title: "", body: "", isActive: true },
  customers: { internalNote: "", tags: [], isBlocked: false },
};
const labelFor = (entity: Entity) =>
  ({
    brands: "brand",
    notes: "note",
    collections: "collection",
    banners: "banner",
    homepage: "section",
    pages: "page",
    customers: "customer",
  })[entity];
export function FilterBuilder({
  value,
  onChange,
  choices,
}: {
  value: RecordData;
  onChange: (value: RecordData) => void;
  choices: Choices;
}) {
  const plain = (values: string[]) => values.map((v) => ({ value: v, label: humanize(v) }));
  const groups: [string, string, { value: string; label: string }[]][] = [
    ["brand", "Brands", choices.brands.map((v) => ({ value: v.slug, label: v.name }))],
    ["brandType", "Brand types", plain(["designer", "niche", "arabian", "celebrity", "local"])],
    ["gender", "Gender", plain(["men", "women", "unisex"])],
    [
      "concentration",
      "Concentration",
      ["edt", "edp", "parfum", "extrait", "edc", "oil", "attar"].map((v) => ({ value: v, label: v.toUpperCase() })),
    ],
    ["packaging", "Packaging", plain(["standard", "tester", "sample", "mini", "gift_set"])],
    ["family", "Fragrance families", choices.families.map((v) => ({ value: v, label: v }))],
    ["note", "Notes", choices.notes.map((v) => ({ value: v.slug, label: v.name }))],
    [
      "size",
      "Size",
      [
        { value: "under-50", label: "Under 50 ml" },
        { value: "50-99", label: "50–99 ml" },
        { value: "100-plus", label: "100 ml +" },
      ],
    ],
  ];
  return (
    <div className="admin-form">
      {groups.map(([key, label, options]) => (
        <ChipMulti
          key={key}
          label={label}
          options={options}
          value={(value[key] as string[]) ?? []}
          onChange={(v) => onChange({ ...value, [key]: v })}
        />
      ))}
      <div className="admin-form-grid">
        {["minPrice", "maxPrice"].map((key) => (
          <label key={key} className="admin-field">
            <span>{key === "minPrice" ? "Minimum price" : "Maximum price"}</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={String(value[key] ?? "")}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
        <label className="admin-field">
          <span>Search terms</span>
          <input value={String(value.q ?? "")} onChange={(e) => onChange({ ...value, q: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>Default sort</span>
          <select value={String(value.sort ?? "newest")} onChange={(e) => onChange({ ...value, sort: e.target.value })}>
            {[
              ["newest", "Newest"],
              ["price-asc", "Price, low to high"],
              ["price-desc", "Price, high to low"],
              ["discount", "Biggest discount"],
              ["name", "Name"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-switch-list">
        <SwitchField label="In stock only" checked={Boolean(value.inStock)} onChange={(v) => onChange({ ...value, inStock: v })} />
        <SwitchField label="Deals only" checked={Boolean(value.deal)} onChange={(v) => onChange({ ...value, deal: v })} />
      </div>
    </div>
  );
}
function SectionConfig({
  type,
  value,
  onChange,
  choices,
}: {
  type: string;
  value: RecordData;
  onChange: (v: RecordData) => void;
  choices: Choices;
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  const collection = (
    <label className="admin-field">
      <span>Collection</span>
      <select
        value={String(value.collectionId ?? "")}
        onChange={(e) => set("collectionId", e.target.value)}
        required
      >
        <option value="">Choose collection</option>
        {choices.collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
  if (type === "product_carousel")
    return (
      <div className="admin-form">
        <ChipChoice
          label="Products from"
          value={String(value.source ?? "featured")}
          options={["featured", "new", "deals", "collection"]}
          onChange={(v) => set("source", v)}
          format={(v) => ({ featured: "Featured", new: "New arrivals", deals: "Deals", collection: "A collection" })[v] ?? v}
        />
        <div className="admin-form-grid">
          {value.source === "collection" && collection}
          <label className="admin-field">
            <span>Number of products</span>
            <input
              type="number"
              min={1}
              max={24}
              value={Number(value.limit ?? 8)}
              onChange={(e) => set("limit", Number(e.target.value))}
            />
          </label>
        </div>
      </div>
    );
  if (type === "collection_banner")
    return (
      <div className="admin-form">
        <div className="admin-form-grid">
          {collection}
          <label className="admin-field">
            <span>Button text</span>
            <input value={String(value.ctaLabel ?? "")} onChange={(e) => set("ctaLabel", e.target.value)} />
          </label>
        </div>
        <ImageField
          label="Image override"
          value={String(value.imageUrl ?? "")}
          onChange={(v) => set("imageUrl", v)}
          hint="Leave empty to use the collection's hero image."
        />
      </div>
    );
  if (type === "category_tiles" || type === "value_props") {
    const key = type === "category_tiles" ? "tiles" : "items";
    const rows = (value[key] as RecordData[]) ?? [];
    const update = (index: number, k: string, v: unknown) =>
      set(
        key,
        rows.map((row, i) => (i === index ? { ...row, [k]: v } : row)),
      );
    return (
      <div className="admin-repeat">
        {rows.map((r, i) => (
          <div className="admin-repeat-item" key={i}>
            <div className="admin-repeat-head">
              <strong>
                {key === "tiles" ? "Tile" : "Item"} {i + 1}
              </strong>
              <button
                type="button"
                className="admin-btn icon sm ghost"
                aria-label={`Remove ${key === "tiles" ? "tile" : "item"} ${i + 1}`}
                onClick={() => set(key, rows.filter((_, n) => n !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Title</span>
                <input value={String(r.title ?? "")} onChange={(e) => update(i, "title", e.target.value)} />
              </label>
              {key === "tiles" ? (
                <label className="admin-field">
                  <span>Link</span>
                  <input value={String(r.href ?? "")} onChange={(e) => update(i, "href", e.target.value)} />
                </label>
              ) : (
                <label className="admin-field">
                  <span>Icon</span>
                  <select value={String(r.icon ?? "shield-check")} onChange={(e) => update(i, "icon", e.target.value)}>
                    {["shield-check", "phone", "truck", "message-circle"].map((v) => (
                      <option key={v} value={v}>
                        {humanize(v.replaceAll("-", " "))}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {key === "tiles" ? (
              <ImageField label="Tile image" value={String(r.imageUrl ?? "")} onChange={(v) => update(i, "imageUrl", v)} />
            ) : (
              <label className="admin-field">
                <span>Description</span>
                <textarea rows={2} value={String(r.description ?? "")} onChange={(e) => update(i, "description", e.target.value)} />
              </label>
            )}
          </div>
        ))}
        <button
          type="button"
          className="admin-add-tile"
          onClick={() =>
            set(key, [
              ...rows,
              key === "tiles"
                ? { title: "", href: "/products", imageUrl: "" }
                : { title: "", description: "", icon: "shield-check" },
            ])
          }
        >
          <Plus size={16} /> Add {key === "tiles" ? "tile" : "item"}
        </button>
      </div>
    );
  }
  return (
    <p className="admin-callout" data-tone="info">
      {type === "brand_strip"
        ? "Displays featured brands in their sort order. Feature a brand from Brands."
        : `This section shows ${type === "hero" ? "hero" : "event card"} banners. Manage their images and links in Banners.`}
    </p>
  );
}
function safeSlug(value: string) {
  try {
    return slugify(value);
  } catch {
    return "";
  }
}
export function EntityEditor({
  entity,
  initial,
  choices,
  onSaved,
  compact,
}: {
  entity: Entity;
  initial?: RecordData;
  choices: Choices;
  onSaved?: (id: string) => void;
  compact?: boolean;
}) {
  const [data, setData] = useState<RecordData>({
    ...defaults[entity],
    ...initial,
  });
  const [result, setResult] = useState<ActionResult>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const [tagsText, setTagsText] = useState(
    ((initial?.tags ?? []) as string[]).join(", "),
  );
  const [snapshot, setSnapshot] = useState(() => JSON.stringify([data, tagsText]));
  const dirty = JSON.stringify([data, tagsText]) !== snapshot;
  useUnsavedGuard(dirty && !pending && !compact);
  const id = initial?.id as string | undefined;
  const errors = result?.ok === false ? (result.errors ?? {}) : {};
  const set = (key: string, value: unknown) =>
    setData((d) => ({
      ...d,
      [key]: value,
      ...((key === "name" || key === "title") &&
      !id &&
      (!d.slug || d.slug === safeSlug(String(d[key] ?? "")))
        ? { slug: safeSlug(String(value)) }
        : {}),
    }));
  function run(fn: () => Promise<ActionResult>) {
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.ok) {
          setSnapshot(JSON.stringify([data, tagsText]));
          toast.success(r.message);
          router.refresh();
          if (onSaved && r.id) onSaved(r.id);
          else if (r.id)
            router.replace(
              `${pathname}?${entity === "collections" || entity === "notes" ? `tab=${entity}&` : ""}id=${r.id}`,
            );
          else router.replace(pathname);
        } else toast.error(r.message);
      } catch {
        setResult({ ok: false, message: "Unable to save. Try again." });
      }
    });
  }
  const list = fields[entity];
  const text = list.filter((f) => !f.kind || f.kind === "number" || f.kind === "datetime-local" || f.kind === "textarea");
  const renderText = (f: Field) => {
    const value = data[f.key];
    const error = errors[f.key];
    return (
      <label key={f.key} className={`admin-field${f.kind === "textarea" || f.wide ? " span-all" : ""}`}>
        <span>{f.label}</span>
        {f.kind === "textarea" ? (
          <textarea rows={4} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} />
        ) : f.key === "slug" && entity !== "notes" ? (
          <span className="admin-input-affix">
            <em>/{{ brands: "brands", collections: "c", pages: "pages" }[entity as string]}/</em>
            <input value={String(value ?? "")} aria-invalid={Boolean(error)} onChange={(e) => set(f.key, e.target.value)} />
          </span>
        ) : (
          <input
            type={f.kind ?? "text"}
            min={f.kind === "number" ? 0 : undefined}
            step={f.kind === "number" ? 1 : undefined}
            aria-invalid={Boolean(error)}
            value={
              f.key === "tags"
                ? tagsText
                : f.kind === "datetime-local" && value
                  ? localDate(String(value))
                  : String(value ?? "")
            }
            onChange={(e) =>
              f.key === "tags"
                ? setTagsText(e.target.value)
                : set(
                    f.key,
                    f.kind === "number"
                      ? Number(e.target.value)
                      : f.kind === "datetime-local"
                        ? e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null
                        : e.target.value,
                  )
            }
          />
        )}
        {f.hint && !error && <small className="admin-hint">{f.hint}</small>}
        <FieldError error={error} />
      </label>
    );
  };
  return (
    <form
      className="admin-entity-form"
      data-compact={compact || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          saveEntity(
            entity,
            id,
            entity === "customers"
              ? {
                  ...data,
                  tags: tagsText
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }
              : data,
          ),
        );
      }}
    >
      <div className="admin-form">
        {list
          .filter((f) => f.options)
          .map((f) => (
            <div key={f.key}>
              <ChipChoice
                label={f.label}
                value={String(data[f.key] ?? f.options![0])}
                options={f.options!}
                onChange={(v) => set(f.key, v)}
                format={humanize}
              />
              <FieldError error={errors[f.key]} />
            </div>
          ))}
        {text.length > 0 && <div className="admin-form-grid">{text.map(renderText)}</div>}
        {list
          .filter((f) => f.kind === "image")
          .length > 0 && (
          <div className="admin-form-grid">
            {list
              .filter((f) => f.kind === "image")
              .map((f) => (
                <div key={f.key}>
                  <ImageField
                    label={f.label}
                    value={String(data[f.key] ?? "")}
                    onChange={(v) => set(f.key, v || null)}
                    aspect={f.key === "logoUrl" ? "square" : "wide"}
                  />
                  <FieldError error={errors[f.key]} />
                </div>
              ))}
          </div>
        )}
        {list
          .filter((f) => f.kind === "markdown")
          .map((f) => (
            <div key={f.key}>
              <MarkdownField label={f.label} value={String(data[f.key] ?? "")} onChange={(v) => set(f.key, v)} rows={entity === "pages" ? 16 : 8} />
              <FieldError error={errors[f.key]} />
            </div>
          ))}
        {list.some((f) => f.kind === "checkbox") && (
          <div className="admin-switch-list">
            {list
              .filter((f) => f.kind === "checkbox")
              .map((f) => (
                <SwitchField key={f.key} label={f.label} description={f.hint} checked={Boolean(data[f.key])} onChange={(v) => set(f.key, v)} />
              ))}
          </div>
        )}
        {entity === "collections" && (
          <section className="admin-subsection">
            <header>
              <h3>Which products belong here</h3>
              <p>The same filters shoppers use on the catalog page. Products matching all selected groups appear in this collection.</p>
            </header>
            <FilterBuilder value={data.filterJson as RecordData} choices={choices} onChange={(v) => set("filterJson", v)} />
          </section>
        )}
        {entity === "homepage" && (
          <section className="admin-subsection">
            <header>
              <h3>{humanize(String(data.type))} settings</h3>
            </header>
            <SectionConfig type={String(data.type)} value={data.config as RecordData} choices={choices} onChange={(v) => set("config", v)} />
          </section>
        )}
        {result && !result.ok && <Result result={result} />}
      </div>
      <div className="admin-form-foot" data-dirty={dirty || undefined}>
        <div>
          {id && entity !== "customers" && (
            <ConfirmButton
              title={`Delete this ${labelFor(entity)}?`}
              body={
                entity === "pages"
                  ? "This page may be linked from the store footer. Links to it will stop working."
                  : entity === "brands"
                    ? "Brands with products can't be deleted. Hide their products instead."
                    : "This can't be undone."
              }
              confirmLabel="Delete"
              disabled={pending}
              onConfirm={() => run(() => deleteEntity(entity, id))}
            >
              <Trash2 size={15} /> Delete
            </ConfirmButton>
          )}
          {id && entity === "brands" && (
            <ConfirmButton
              className="admin-btn ghost"
              title="Hide every product from this brand?"
              body="All of this brand's products will be set to hidden. You can re-activate them from Products."
              confirmLabel="Hide products"
              disabled={pending}
              onConfirm={() => run(() => deactivateBrand(id))}
            >
              <EyeOff size={15} /> Hide brand products
            </ConfirmButton>
          )}
        </div>
        <div>
          {dirty && !compact && <span className="admin-unsaved"><i aria-hidden /> Unsaved</span>}
          <button className="admin-btn primary" disabled={pending}>
            {pending && <LoaderCircle size={16} className="admin-spin" />}
            {id ? "Save changes" : `Create ${labelFor(entity)}`}
          </button>
        </div>
      </div>
    </form>
  );
}
function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function InlineCreate({
  entity,
  choices,
  onCreated,
}: {
  entity: "brands" | "notes";
  choices: Choices;
  onCreated: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0);
  return (
    <>
      <button
        type="button"
        className="admin-text-btn"
        onClick={() => {
          setOpen((n) => n + 1);
          dialog.current?.showModal();
        }}
      >
        <Plus size={14} /> New {entity === "brands" ? "brand" : "note"}
      </button>
      <dialog ref={dialog} className="admin-dialog">
        <div className="admin-dialog-head">
          <div>
            <h2>New {entity === "brands" ? "brand" : "note"}</h2>
            <p>
              {entity === "brands"
                ? "Add the basics now; logo and story can be filled in later from Brands."
                : "Notes are shared across all products."}
            </p>
          </div>
          <button type="button" className="admin-btn icon ghost" onClick={() => dialog.current?.close()} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="admin-dialog-body">
          {open > 0 && (
            <EntityEditor
              key={open}
              compact
              entity={entity}
              choices={choices}
              onSaved={(id) => {
                dialog.current?.close();
                onCreated(id);
              }}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
