"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Package, Plus, Star, X } from "lucide-react";
import { productFlags } from "@/lib/admin/actions";
import { formatMoney } from "@/lib/money";
import { storeConfig } from "../../../store.config";
type Row = {
  id: string;
  name: string;
  brand: string;
  concentration: string;
  isActive: boolean;
  isFeatured: boolean;
  image: string | null;
  variants: number;
  min: number;
  max: number;
  stock: number;
};
function Stock({ stock }: { stock: number }) {
  const tone = stock === 0 ? "bad" : stock <= storeConfig.catalog.lowStockThreshold ? "warn" : "good";
  return (
    <span className="admin-stock" data-tone={tone}>
      <i aria-hidden />
      {stock === 0 ? "Out of stock" : `${stock} in stock`}
    </span>
  );
}
function Price({ r }: { r: Row }) {
  return (
    <>
      {r.min === r.max ? formatMoney(r.min) : `${formatMoney(r.min)} – ${formatMoney(r.max)}`}
      <small>
        {r.variants} {r.variants === 1 ? "size" : "sizes"}
      </small>
    </>
  );
}
export function ProductList({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  function update(
    ids: string[],
    flags: { isActive?: boolean; isFeatured?: boolean },
  ) {
    start(async () => {
      try {
        const r = await productFlags(ids, flags);
        if (r.ok) {
          toast.success(r.message);
          setSelected([]);
        } else toast.error(r.message);
        router.refresh();
      } catch {
        toast.error("Unable to save.");
      }
    });
  }
  const toggle = (id: string, on: boolean) =>
    setSelected(on ? [...selected, id] : selected.filter((v) => v !== id));
  if (!rows.length)
    return (
      <div className="admin-table-card">
        <div className="admin-empty">
          <span className="admin-empty-icon">
            <Package size={22} />
          </span>
          <strong>No products match</strong>
          <p>Adjust the filters, or add your first product.</p>
          <Link className="admin-btn primary" href="/admin/products/new">
            <Plus size={16} /> New product
          </Link>
        </div>
      </div>
    );
  return (
    <>
      <div className="admin-table-card">
        <table className="admin-table admin-desktop-only">
          <thead>
            <tr>
              <th className="check">
                <input
                  type="checkbox"
                  className="admin-checkbox"
                  aria-label="Select all products"
                  checked={rows.length > 0 && selected.length === rows.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? rows.map((r) => r.id) : [])
                  }
                />
              </th>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
              <th className="center">Active</th>
              <th className="center">Featured</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="admin-row-link" data-selected={selected.includes(r.id) || undefined}>
                <td className="check">
                  <input
                    type="checkbox"
                    className="admin-checkbox admin-above"
                    aria-label={`Select ${r.name}`}
                    checked={selected.includes(r.id)}
                    onChange={(e) => toggle(r.id, e.target.checked)}
                  />
                </td>
                <td>
                  <span className="admin-product-cell">
                    <span className="admin-thumb">
                      {r.image && (
                        <Image unoptimized width={56} height={56} src={r.image} alt="" />
                      )}
                    </span>
                    <span>
                      <Link href={`/admin/products/${r.id}`} className="admin-stretch admin-strong">
                        {r.name}
                      </Link>
                      <small>
                        {r.brand} · {r.concentration.toUpperCase()}
                      </small>
                    </span>
                  </span>
                </td>
                <td>
                  <Price r={r} />
                </td>
                <td>
                  <Stock stock={r.stock} />
                </td>
                <td className="center">
                  <input
                    type="checkbox"
                    role="switch"
                    className="admin-switch admin-above"
                    aria-label={`${r.name} visible in store`}
                    checked={r.isActive}
                    disabled={pending}
                    onChange={(e) => update([r.id], { isActive: e.target.checked })}
                  />
                </td>
                <td className="center">
                  <button
                    type="button"
                    className="admin-star admin-above"
                    aria-pressed={r.isFeatured}
                    aria-label={`Feature ${r.name}`}
                    disabled={pending}
                    onClick={() => update([r.id], { isFeatured: !r.isFeatured })}
                  >
                    <Star size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="admin-cards admin-mobile-only">
          {rows.map((r) => (
            <li key={r.id} className="admin-card-row product">
              <input
                type="checkbox"
                className="admin-checkbox admin-above"
                aria-label={`Select ${r.name}`}
                checked={selected.includes(r.id)}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              <span className="admin-thumb">
                {r.image && <Image unoptimized width={56} height={56} src={r.image} alt="" />}
              </span>
              <span className="admin-card-row-main">
                <Link href={`/admin/products/${r.id}`} className="admin-stretch admin-strong">
                  {r.name}
                </Link>
                <small>
                  {r.brand} · <Price r={r} />
                </small>
                <Stock stock={r.stock} />
              </span>
              <span className="admin-card-row-side">
                <input
                  type="checkbox"
                  role="switch"
                  className="admin-switch admin-above"
                  aria-label={`${r.name} visible in store`}
                  checked={r.isActive}
                  disabled={pending}
                  onChange={(e) => update([r.id], { isActive: e.target.checked })}
                />
                <button
                  type="button"
                  className="admin-star admin-above"
                  aria-pressed={r.isFeatured}
                  aria-label={`Feature ${r.name}`}
                  disabled={pending}
                  onClick={() => update([r.id], { isFeatured: !r.isFeatured })}
                >
                  <Star size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="admin-bulkbar" data-visible={selected.length > 0 || undefined} aria-hidden={!selected.length}>
        <span>
          <strong>{selected.length}</strong> selected
        </span>
        <button
          type="button"
          className="admin-btn sm"
          tabIndex={selected.length ? 0 : -1}
          disabled={pending}
          onClick={() => update(selected, { isActive: true })}
        >
          <Eye size={14} /> Show in store
        </button>
        <button
          type="button"
          className="admin-btn sm"
          tabIndex={selected.length ? 0 : -1}
          disabled={pending}
          onClick={() => update(selected, { isActive: false })}
        >
          <EyeOff size={14} /> Hide
        </button>
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
