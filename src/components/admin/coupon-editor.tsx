"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, LoaderCircle, Shuffle, Trash2 } from "lucide-react";
import { deleteCoupon, saveCoupon, setCouponActive } from "@/lib/admin/actions";
import type { ActionResult } from "@/lib/admin/schema";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/admin/format";
import { generateCouponCode, normalizeCouponCode } from "@/lib/coupons/rules";
import { storeConfig } from "../../../store.config";
import { ChipChoice, ConfirmButton, FieldError, Result, SwitchField, useUnsavedGuard } from "./fields";

export type CouponFormData = {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: number | null;
  minSubtotal: number | null;
  maxUses: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  usedCount: number;
};
const blank: CouponFormData = {
  code: "",
  type: "percent",
  value: 10,
  minSubtotal: null,
  maxUses: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  usedCount: 0,
};
const currency = storeConfig.currency.symbol;
const minorHint = storeConfig.currency.minorUnits ? "In minor units (cents)." : undefined;

/** ISO string ⇄ the browser's datetime-local value, in the admin's local time. */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const numberOrNull = (value: string) => (value === "" ? null : Math.max(0, Math.trunc(Number(value))));

/** One-sentence summary the admin can sanity-check before saving. */
function preview(d: CouponFormData) {
  if (!d.value) return "Set a discount value to preview this coupon.";
  const off = d.type === "percent" ? `${d.value}% off` : `${formatMoney(d.value)} off`;
  const parts = [`Shoppers get ${off} their bag subtotal`];
  if (d.minSubtotal) parts.push(`when it reaches ${formatMoney(d.minSubtotal)}`);
  let sentence = `${parts.join(" ")}.`;
  if (d.maxUses) sentence += ` Limited to ${d.maxUses} ${d.maxUses === 1 ? "order" : "orders"}.`;
  if (d.startsAt || d.endsAt)
    sentence += ` Runs ${d.startsAt ? `from ${formatDate(new Date(d.startsAt))}` : "from now"}${d.endsAt ? ` until ${formatDate(new Date(d.endsAt), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}` : ", with no end date"}.`;
  if (!d.isActive) sentence += " Currently switched off.";
  return sentence;
}

export function CouponEditor({ initial }: { initial?: CouponFormData }) {
  const router = useRouter();
  const [data, setData] = useState<CouponFormData>(initial ?? blank);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(initial ?? blank));
  const [result, setResult] = useState<ActionResult>();
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(data) !== snapshot;
  useUnsavedGuard(dirty && !pending);
  const errors = result?.ok === false ? (result.errors ?? {}) : {};
  const set = <K extends keyof CouponFormData>(key: K, value: CouponFormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));
  function run(fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) {
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.ok) {
          setSnapshot(JSON.stringify(data));
          toast.success(r.message);
          after?.(r);
          router.refresh();
        } else toast.error(r.message);
      } catch {
        toast.error("Unable to save. Try again.");
      }
    });
  }
  return (
    <form
      className="admin-entity-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const { id, code, type, value, minSubtotal, maxUses, startsAt, endsAt, isActive } = data;
        run(
          () => saveCoupon(id, { code, type, value: value ?? 0, minSubtotal, maxUses, startsAt, endsAt, isActive }),
          (r) => {
            if (!id && r.id) router.replace(`/admin/coupons?id=${r.id}`);
          },
        );
      }}
    >
      <div className="admin-form">
        <div className="admin-form-grid">
          <label className="admin-field span-all">
            <span>Code</span>
            <span className="admin-input-affix">
              <input
                className="admin-mono"
                value={data.code}
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. EID25"
                aria-invalid={Boolean(errors.code)}
                onChange={(e) => set("code", normalizeCouponCode(e.target.value))}
              />
              <button
                type="button"
                className="admin-affix-btn"
                title="Generate a code"
                aria-label="Generate a random code"
                onClick={() => set("code", generateCouponCode())}
              >
                <Shuffle size={15} />
              </button>
            </span>
            {errors.code ? (
              <FieldError error={errors.code} />
            ) : (
              <small className="admin-hint">Shoppers type this at checkout. Letters and numbers; not case-sensitive.</small>
            )}
          </label>
        </div>
        <ChipChoice
          label="Discount type"
          value={data.type}
          options={["percent", "fixed"] as const}
          format={(v) => (v === "percent" ? "Percentage" : "Fixed amount")}
          onChange={(v) => set("type", v)}
        />
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>{data.type === "percent" ? "Percent off" : "Amount off"}</span>
            <span className="admin-input-affix">
              {data.type === "fixed" && <em>{currency}</em>}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={data.type === "percent" ? 100 : undefined}
                step={1}
                value={data.value ?? ""}
                aria-invalid={Boolean(errors.value)}
                onChange={(e) => set("value", numberOrNull(e.target.value))}
              />
              {data.type === "percent" && <em className="suffix">%</em>}
            </span>
            {errors.value ? (
              <FieldError error={errors.value} />
            ) : (
              <small className="admin-hint">
                {data.type === "percent" ? "Rounded down to a whole amount." : (minorHint ?? "Never more than the bag subtotal.")}
              </small>
            )}
          </label>
          <label className="admin-field">
            <span>Minimum subtotal</span>
            <span className="admin-input-affix">
              <em>{currency}</em>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="No minimum"
                value={data.minSubtotal ?? ""}
                aria-invalid={Boolean(errors.minSubtotal)}
                onChange={(e) => set("minSubtotal", numberOrNull(e.target.value))}
              />
            </span>
            {errors.minSubtotal ? <FieldError error={errors.minSubtotal} /> : <small className="admin-hint">Before delivery. Leave empty for none.</small>}
          </label>
          <label className="admin-field">
            <span>Usage limit</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="Unlimited"
              value={data.maxUses ?? ""}
              aria-invalid={Boolean(errors.maxUses)}
              onChange={(e) => set("maxUses", numberOrNull(e.target.value))}
            />
            {errors.maxUses ? (
              <FieldError error={errors.maxUses} />
            ) : (
              <small className="admin-hint">
                Total orders across all shoppers.{data.id ? ` Used ${data.usedCount} so far.` : ""}
              </small>
            )}
          </label>
        </div>
        <div className="admin-form-grid">
          {(["startsAt", "endsAt"] as const).map((key) => (
            <label key={key} className="admin-field">
              <span>{key === "startsAt" ? "Starts" : "Ends"}</span>
              <input
                type="datetime-local"
                value={toLocalInput(data[key])}
                aria-invalid={Boolean(errors[key])}
                onChange={(e) => set(key, e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
              {errors[key] ? (
                <FieldError error={errors[key]} />
              ) : (
                <small className="admin-hint">{key === "startsAt" ? "Your local time. Empty starts now." : "Empty runs until you switch it off."}</small>
              )}
            </label>
          ))}
        </div>
        <div className="admin-switch-list">
          <SwitchField
            label="Active"
            description="Switch off to pause the code without deleting it."
            checked={data.isActive}
            onChange={(v) => set("isActive", v)}
          />
        </div>
        <div className="admin-callout" data-tone="info">
          <p className="admin-inline">
            <Info size={15} aria-hidden /> {preview(data)}
          </p>
        </div>
        {result && !result.ok && <Result result={result} />}
      </div>
      <div className="admin-form-foot" data-dirty={dirty || undefined}>
        <div>
          {data.id && (
            <ConfirmButton
              title={`Delete ${data.code}?`}
              body="Shoppers can no longer use it. Orders that already used it keep their discount."
              confirmLabel="Delete coupon"
              disabled={pending}
              onConfirm={() => run(() => deleteCoupon(data.id!), () => router.replace("/admin/coupons"))}
            >
              <Trash2 size={15} /> Delete
            </ConfirmButton>
          )}
        </div>
        <div>
          {dirty && (
            <span className="admin-unsaved">
              <i aria-hidden /> Unsaved
            </span>
          )}
          <button className="admin-btn primary" disabled={pending}>
            {pending && <LoaderCircle size={16} className="admin-spin" />}
            {data.id ? "Save changes" : "Create coupon"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Inline on/off switch for the coupon list. */
export function CouponSwitch({ id, code, active }: { id: string; code: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      role="switch"
      className="admin-switch admin-above"
      aria-label={`${code} active`}
      checked={active}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          const r = await setCouponActive(id, next);
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
          router.refresh();
        });
      }}
    />
  );
}
