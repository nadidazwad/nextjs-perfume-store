"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Link2, LoaderCircle, RefreshCw, Trash2, X } from "lucide-react";
import { Markdown } from "@/components/storefront/markdown";
import type { ActionResult } from "@/lib/admin/schema";
export function Result({ result }: { result?: ActionResult }) {
  return result ? (
    <div
      role={result.ok ? "status" : "alert"}
      className="admin-callout"
      data-tone={result.ok ? "good" : "bad"}
    >
      <p>{result.message}</p>
      {result.errors && (
        <ul>
          {Object.entries(result.errors).map(([key, value]) => (
            <li key={key}>
              <strong>{key.replace(/\.(\d+)\./, " $1 · ")}</strong> {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
}
export function FieldError({ error }: { error?: string }) {
  return error ? <span className="admin-field-error">{error}</span> : null;
}
export function MarkdownField({
  label,
  value,
  onChange,
  rows = 10,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  const [preview, setPreview] = useState(false);
  const id = useId();
  return (
    <div className="admin-field admin-markdown">
      <div className="admin-field-row">
        <label htmlFor={id}>{label}</label>
        <div className="admin-mini-tabs" role="tablist" aria-label={`${label} mode`}>
          <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)}>
            Preview
          </button>
        </div>
      </div>
      {preview ? (
        <div className="admin-preview">
          {value.trim() ? <Markdown body={value} /> : <p className="admin-muted">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={30000}
          rows={rows}
          placeholder="Supports **bold**, _italic_, lists and [links](/products)."
        />
      )}
      {hint && <small className="admin-hint">{hint}</small>}
    </div>
  );
}
export async function uploadImage(file: File) {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP under 5 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Cannot convert image."))),
      "image/webp",
      0.85,
    ),
  );
  const form = new FormData();
  form.append("file", blob, "image.webp");
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data.url as string;
}
/** Drop zone + preview. Accepts a file (resized to WebP) or a pasted URL. */
export function ImageField({
  label,
  value,
  onChange,
  aspect = "wide",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  aspect?: "wide" | "square";
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-field">
      <div className="admin-field-row">
        <span>{label}</span>
        <button type="button" className="admin-text-btn" onClick={() => setUrlMode(!urlMode)}>
          {urlMode ? "Upload a file" : (
            <>
              <Link2 size={13} /> Use a URL
            </>
          )}
        </button>
      </div>
      {urlMode && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or /path/in/public.webp"
          maxLength={2000}
          aria-label={`${label} URL`}
        />
      )}
      <div
        className="admin-drop"
        data-aspect={aspect}
        data-over={over || undefined}
        data-filled={value ? true : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy) void upload(e.dataTransfer.files[0]);
        }}
      >
        {value ? (
          <>
            <Image unoptimized fill src={value} alt={`${label} preview`} sizes="400px" />
            <div className="admin-drop-actions">
              <button type="button" className="admin-btn sm" onClick={() => input.current?.click()} disabled={busy}>
                <RefreshCw size={13} /> Replace
              </button>
              <button type="button" className="admin-btn sm icon" onClick={() => onChange("")} aria-label={`Remove ${label}`}>
                <Trash2 size={13} />
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="admin-drop-empty" onClick={() => input.current?.click()} disabled={busy}>
            <span className="admin-icon-tile">
              {busy ? <LoaderCircle size={18} className="admin-spin" /> : <ImagePlus size={18} />}
            </span>
            <strong>{busy ? "Uploading…" : "Drop an image or browse"}</strong>
            <small>JPEG, PNG or WebP up to 5 MB</small>
          </button>
        )}
        {busy && value && (
          <span className="admin-drop-busy">
            <LoaderCircle size={20} className="admin-spin" />
          </span>
        )}
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {hint && <small className="admin-hint">{hint}</small>}
      {error && (
        <p className="admin-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="admin-switch-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="admin-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
/** Pill-shaped radio group, e.g. gender / concentration. */
export function ChipChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  format = (v) => v,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  format?: (value: T) => string;
}) {
  const name = useId();
  return (
    <fieldset className="admin-choice-group">
      <legend>{label}</legend>
      <div className="admin-chips">
        {options.map((o) => (
          <label className="admin-chip" key={o}>
            <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
            {format(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
/** Multi-select as toggle chips, with a filter box for long lists. */
export function ChipMulti({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: { value: string; label: string }[];
  onChange: (value: string[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const shown = options.filter(
    (o) => value.includes(o.value) || o.label.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <fieldset className="admin-choice-group">
      <legend>
        {label}
        {value.length > 0 && <span className="admin-count">{value.length}</span>}
      </legend>
      {options.length > 12 && (
        <input
          className="admin-chip-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${label.toLowerCase()}`}
          aria-label={`Filter ${label}`}
        />
      )}
      <div className="admin-chips" data-scroll={options.length > 24 || undefined}>
        {shown.map((o) => (
          <label className="admin-chip" key={o.value}>
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
              }
            />
            {o.label}
          </label>
        ))}
        {!shown.length && <small className="admin-muted">No matches</small>}
      </div>
    </fieldset>
  );
}
/** Destructive action behind a modal confirmation instead of window.confirm. */
export function ConfirmButton({
  children,
  title,
  body,
  confirmLabel,
  onConfirm,
  disabled,
  className = "admin-btn danger-ghost",
}: {
  children: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => dialog.current?.showModal()}>
        {children}
      </button>
      <dialog ref={dialog} className="admin-dialog sm">
        <div className="admin-dialog-head">
          <span className="admin-icon-tile" data-tone="bad">
            <Trash2 size={18} />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
          <button type="button" className="admin-btn icon ghost" onClick={() => dialog.current?.close()} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="admin-dialog-foot">
          <button type="button" className="admin-btn" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn danger"
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
/** Warn before leaving a page with unsaved edits. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
