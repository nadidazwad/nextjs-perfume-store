"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Check, MessageSquareText, RotateCcw, Star, Trash2, X } from "lucide-react";
import { deleteReviews, moderateReviews } from "@/lib/admin/actions";
import type { ActionResult } from "@/lib/admin/schema";
import { ConfirmButton } from "./fields";
import { EmptyState, Tag } from "./ui";

export type ReviewRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  rating: number;
  title: string | null;
  body: string;
  name: string;
  phone: string | null;
  verified: boolean;
  created: string;
  product: { id: string; name: string; slug: string; brand: string; image: string | null };
};
const statusTone = { pending: "warn", approved: "good", rejected: "bad" } as const;
const statusLabel = { pending: "Pending", approved: "Published", rejected: "Rejected" } as const;

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="admin-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} data-on={n <= rating || undefined} aria-hidden />
      ))}
    </span>
  );
}

export function ReviewQueue({ rows, empty }: { rows: ReviewRow[]; empty: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  function run(ids: string[], fn: () => Promise<ActionResult>) {
    setBusyId(ids.length === 1 ? ids[0] : null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message);
          setSelected((s) => s.filter((id) => !ids.includes(id)));
        } else toast.error(r.message);
        router.refresh();
      } catch {
        toast.error("Unable to update reviews. Try again.");
      } finally {
        setBusyId(null);
      }
    });
  }
  const moderate = (ids: string[], status: ReviewRow["status"]) => run(ids, () => moderateReviews(ids, status));
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((v) => v !== id)));
  if (!rows.length)
    return (
      <div className="admin-table-card">
        <EmptyState icon={<MessageSquareText size={22} />} title={empty}>
          New reviews from product pages land here for approval before they go live.
        </EmptyState>
      </div>
    );
  const all = selected.length === rows.length;
  return (
    <>
      <div className="admin-table-card">
        <div className="admin-review-toolbar">
          <label className="admin-inline">
            <input
              type="checkbox"
              className="admin-checkbox"
              checked={all}
              onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
            />
            Select all on this page
          </label>
        </div>
        <ul className="admin-reviews">
          {rows.map((r) => {
            const busy = pending && (busyId === r.id || (busyId === null && selected.includes(r.id)));
            return (
              <li key={r.id} className="admin-review" data-selected={selected.includes(r.id) || undefined} aria-busy={busy || undefined}>
                <input
                  type="checkbox"
                  className="admin-checkbox"
                  aria-label={`Select review by ${r.name}`}
                  checked={selected.includes(r.id)}
                  onChange={(e) => toggle(r.id, e.target.checked)}
                />
                <div className="admin-review-main">
                  <div className="admin-review-head">
                    <Stars rating={r.rating} />
                    <Tag tone={statusTone[r.status]}>{statusLabel[r.status]}</Tag>
                    {r.verified && (
                      <Tag tone="info">
                        <BadgeCheck size={12} /> Verified purchase
                      </Tag>
                    )}
                    <small className="admin-muted">{r.created}</small>
                  </div>
                  {r.title && <strong className="admin-review-title">{r.title}</strong>}
                  <p className="admin-review-body">{r.body}</p>
                  <div className="admin-review-meta">
                    <span>
                      <strong>{r.name}</strong>
                      {r.phone ? <span className="admin-mono"> · {r.phone}</span> : <span className="admin-muted"> · no phone</span>}
                    </span>
                    <Link href={`/admin/products/${r.product.id}`} className="admin-review-product">
                      <span className="admin-thumb sm">
                        {r.product.image && <Image unoptimized width={32} height={32} src={r.product.image} alt="" />}
                      </span>
                      <span>
                        <small>{r.product.brand}</small>
                        {r.product.name}
                      </span>
                    </Link>
                  </div>
                </div>
                <div className="admin-review-actions">
                  {r.status !== "approved" && (
                    <button type="button" className="admin-btn sm primary" disabled={pending} onClick={() => moderate([r.id], "approved")}>
                      <Check size={14} /> Approve
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button type="button" className="admin-btn sm" disabled={pending} onClick={() => moderate([r.id], "rejected")}>
                      <X size={14} /> Reject
                    </button>
                  )}
                  {r.status !== "pending" && (
                    <button type="button" className="admin-btn sm ghost" disabled={pending} onClick={() => moderate([r.id], "pending")}>
                      <RotateCcw size={14} /> Back to pending
                    </button>
                  )}
                  <a className="admin-btn sm ghost" href={`/products/${r.product.slug}#reviews`} target="_blank" rel="noreferrer">
                    View product
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="admin-bulkbar" data-visible={selected.length > 0 || undefined} aria-hidden={!selected.length} inert={!selected.length}>
        <span>
          <strong>{selected.length}</strong> selected
        </span>
        <button
          type="button"
          className="admin-btn sm primary"
          tabIndex={selected.length ? 0 : -1}
          disabled={pending}
          onClick={() => moderate(selected, "approved")}
        >
          <Check size={14} /> Approve
        </button>
        <button
          type="button"
          className="admin-btn sm"
          tabIndex={selected.length ? 0 : -1}
          disabled={pending}
          onClick={() => moderate(selected, "rejected")}
        >
          <X size={14} /> Reject
        </button>
        <ConfirmButton
          className="admin-btn sm icon"
          title={`Delete ${selected.length} ${selected.length === 1 ? "review" : "reviews"}?`}
          body="Deleted reviews can't be restored. Reject instead if you might need them later."
          confirmLabel="Delete"
          disabled={pending || !selected.length}
          onConfirm={() => {
            const ids = selected;
            run(ids, () => deleteReviews(ids));
          }}
        >
          <Trash2 size={14} />
          <span className="admin-sr-only">Delete selected</span>
        </ConfirmButton>
        <button
          type="button"
          className="admin-btn icon sm ghost"
          tabIndex={selected.length ? 0 : -1}
          aria-label="Clear selection"
          onClick={() => setSelected([])}
        >
          <X size={14} />
        </button>
      </div>
    </>
  );
}
