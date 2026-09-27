"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, LoaderCircle } from "lucide-react";
import { reorder } from "@/lib/admin/actions";
export type SortRow = {
  id: string;
  title: string;
  meta?: string;
  image?: string | null;
  isActive: boolean;
  badge?: string;
};
export function Sortable({
  entity,
  rows,
}: {
  entity: "homepage" | "banners";
  rows: SortRow[];
}) {
  const [items, setItems] = useState(rows);
  const [drag, setDrag] = useState<number>();
  const [over, setOver] = useState<number>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const changed = items.some((r, i) => r.id !== rows[i]?.id);
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setItems(next);
  }
  return (
    <div className="admin-sortable">
      <ol>
        {items.map((r, i) => (
          <li
            className="admin-sort-row"
            key={r.id}
            draggable={!pending}
            data-dragging={drag === i || undefined}
            data-over={over === i && drag !== i ? true : undefined}
            onDragStart={() => setDrag(i)}
            onDragEnd={() => {
              setDrag(undefined);
              setOver(undefined);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag !== undefined) move(drag, i);
              setDrag(undefined);
              setOver(undefined);
            }}
          >
            <span className="admin-sort-grip" aria-hidden>
              <GripVertical size={16} />
            </span>
            <span className="admin-sort-index">{String(i + 1).padStart(2, "0")}</span>
            {r.image !== undefined && (
              <span className="admin-thumb wide">
                {r.image && <Image unoptimized fill sizes="120px" src={r.image} alt="" />}
              </span>
            )}
            <span className="admin-sort-main">
              <Link href={`/admin/${entity}?id=${r.id}`} className="admin-stretch admin-strong">
                {r.title}
              </Link>
              {r.meta && <small>{r.meta}</small>}
            </span>
            {r.badge && <span className="admin-tag admin-hide-sm">{r.badge}</span>}
            <span className="admin-tag" data-tone={r.isActive ? "good" : "neutral"}>
              {r.isActive ? "Live" : "Hidden"}
            </span>
            <span className="admin-sort-moves">
              <button
                type="button"
                className="admin-btn icon sm ghost admin-above"
                aria-label={`Move ${r.title} up`}
                disabled={i === 0 || pending}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="admin-btn icon sm ghost admin-above"
                aria-label={`Move ${r.title} down`}
                disabled={i === items.length - 1 || pending}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={14} />
              </button>
            </span>
            <ChevronRight size={16} className="admin-chevron admin-hide-sm" />
          </li>
        ))}
      </ol>
      <div className="admin-savebar" data-visible={changed || undefined}>
        <span>
          <i aria-hidden /> New order not saved
        </span>
        <div>
          <button type="button" className="admin-btn sm ghost" disabled={pending} onClick={() => setItems(rows)}>
            Reset
          </button>
          <button
            type="button"
            className="admin-btn sm primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const r = await reorder(
                    entity,
                    items.map((row) => row.id),
                  );
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                  router.refresh();
                } catch {
                  toast.error("Unable to save order.");
                }
              })
            }
          >
            {pending && <LoaderCircle size={14} className="admin-spin" />}
            Save order
          </button>
        </div>
      </div>
    </div>
  );
}
