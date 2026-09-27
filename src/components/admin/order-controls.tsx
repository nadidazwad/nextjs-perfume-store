"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CircleCheck,
  LoaderCircle,
  PackageCheck,
  Phone,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  StickyNote,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import type { orders } from "@/db/schema";
import { updateOrder } from "@/lib/admin/actions";
import type { ActionResult } from "@/lib/admin/schema";
import { ORDER_TRANSITIONS } from "@/lib/orders/matrix";
import { PAYMENT_LABELS } from "@/lib/admin/format";
type Order = typeof orders.$inferSelect;
type Target = (typeof ORDER_TRANSITIONS)[keyof typeof ORDER_TRANSITIONS][number];
const actions: Record<Target, { label: string; verb: string; icon: LucideIcon; blurb: string }> = {
  confirmed: {
    label: "Confirm order",
    verb: "Confirm",
    icon: CircleCheck,
    blurb: "The customer confirmed by phone. Stock is reserved for every item.",
  },
  packed: {
    label: "Mark packed",
    verb: "Pack",
    icon: PackageCheck,
    blurb: "Items are boxed and ready for the courier.",
  },
  shipped: {
    label: "Ship order",
    verb: "Ship",
    icon: Truck,
    blurb: "Hand the parcel to the courier and record its tracking ID.",
  },
  delivered: {
    label: "Mark delivered",
    verb: "Deliver",
    icon: CircleCheck,
    blurb: "The parcel reached the customer.",
  },
  cancelled: {
    label: "Cancel order",
    verb: "Cancel",
    icon: Ban,
    blurb: "Reserved stock is returned automatically if the order was confirmed.",
  },
  returned: {
    label: "Mark returned",
    verb: "Return",
    icon: RotateCcw,
    blurb: "The parcel came back. Stock is restored to inventory.",
  },
};
const reasons = [
  "No answer ×3",
  "Customer declined",
  "Duplicate",
  "Suspected fake",
  "Other",
];

function useOrderAction(orderId: string) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>();
  const router = useRouter();
  function run(data: Record<string, unknown>, onDone?: () => void) {
    setResult(undefined);
    start(async () => {
      try {
        const r = await updateOrder(orderId, data);
        setResult(r);
        if (r.ok) {
          toast.success(r.message);
          onDone?.();
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: "Unable to save. Try again." });
      }
    });
  }
  return { run, pending, result };
}

function FormError({ result }: { result?: ActionResult }) {
  if (!result || result.ok) return null;
  return (
    <div role="alert" className="admin-callout" data-tone="bad">
      <p>{result.message}</p>
      {result.errors && (
        <ul>
          {Object.entries(result.errors).map(([key, value]) => (
            <li key={key}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Header buttons for the legal next statuses; each opens a focused dialog. */
export function OrderActions({ order }: { order: Order }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Target>();
  const [reason, setReason] = useState("");
  const { run, pending, result } = useOrderAction(order.id);
  const targets = ORDER_TRANSITIONS[order.status] as readonly Target[];
  if (!targets.length)
    return (
      <span className="admin-tag" data-tone="neutral">
        Closed order
      </span>
    );
  const open = (status: Target) => {
    setSelected(status);
    setReason("");
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const current = selected && actions[selected];
  const danger = selected === "cancelled" || selected === "returned";
  return (
    <>
      {[
        ...targets.filter((t) => t === "cancelled" || t === "returned"),
        ...targets.filter((t) => t !== "cancelled" && t !== "returned"),
      ].map((status) => {
          const { label, icon: Icon } = actions[status];
          const negative = status === "cancelled" || status === "returned";
          return (
            <button
              key={status}
              type="button"
              className={`admin-btn ${negative ? "danger-ghost" : "primary"}`}
              disabled={pending}
              onClick={() => open(status)}
            >
              <Icon size={16} /> {label}
            </button>
          );
        })}
      <dialog ref={dialog} className="admin-dialog" onClose={() => setSelected(undefined)}>
        {current && selected && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              run(
                {
                  kind: "transition",
                  status: selected,
                  message: String(d.get("message") ?? "").trim() || undefined,
                  cancelledReason:
                    selected === "cancelled"
                      ? reason === "Other"
                        ? String(d.get("detail") ?? "").trim()
                        : reason
                      : undefined,
                  courierName: d.get("courierName") || undefined,
                  trackingId: d.get("trackingId") || undefined,
                  paymentVerified:
                    d.get("paymentVerified") === "on" ? true : undefined,
                },
                close,
              );
            }}
          >
            <div className="admin-dialog-head">
              <span className="admin-icon-tile" data-tone={danger ? "bad" : undefined}>
                <current.icon size={18} />
              </span>
              <div>
                <h2>
                  {current.verb} {order.orderNumber}
                </h2>
                <p>{current.blurb}</p>
              </div>
              <button type="button" className="admin-btn icon ghost" onClick={close} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="admin-dialog-body">
              {selected === "cancelled" && (
                <>
                  <fieldset className="admin-choice-group">
                    <legend>Reason</legend>
                    <div className="admin-chips">
                      {reasons.map((v) => (
                        <label key={v} className="admin-chip">
                          <input
                            type="radio"
                            name="reason"
                            value={v}
                            required
                            checked={reason === v}
                            onChange={() => setReason(v)}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {reason === "Other" && (
                    <label className="admin-field">
                      <span>Describe the reason</span>
                      <textarea name="detail" maxLength={1000} required rows={3} />
                    </label>
                  )}
                </>
              )}
              {selected === "shipped" && (
                <div className="admin-form-grid">
                  <label className="admin-field">
                    <span>Courier</span>
                    <input name="courierName" required maxLength={120} placeholder="e.g. Pathao, Steadfast" />
                  </label>
                  <label className="admin-field">
                    <span>Tracking ID</span>
                    <input name="trackingId" required maxLength={160} />
                  </label>
                </div>
              )}
              {selected === "confirmed" && order.paymentMethod !== "cod" && (
                <div className="admin-verify">
                  <div>
                    <small>{PAYMENT_LABELS[order.paymentMethod]} transaction ID</small>
                    <strong className="admin-mono">{order.paymentTxnId ?? "Not supplied"}</strong>
                  </div>
                  <label className="admin-switch-row">
                    <input
                      name="paymentVerified"
                      type="checkbox"
                      role="switch"
                      className="admin-switch"
                      defaultChecked={order.paymentVerified}
                    />
                    Payment verified in the {PAYMENT_LABELS[order.paymentMethod]} app
                  </label>
                </div>
              )}
              <label className="admin-field">
                <span>
                  Timeline note <em>optional</em>
                </span>
                <textarea name="message" maxLength={2000} rows={2} placeholder="Anything the team should know" />
              </label>
              <FormError result={result} />
            </div>
            <div className="admin-dialog-foot">
              <button type="button" className="admin-btn" onClick={close} disabled={pending}>
                Keep as is
              </button>
              <button className={`admin-btn ${danger ? "danger" : "primary"}`} disabled={pending}>
                {pending && <LoaderCircle size={16} className="admin-spin" />}
                {current.label}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

export function VerifyPayment({ order }: { order: Order }) {
  const { run, pending, result } = useOrderAction(order.id);
  return (
    <>
      <button
        type="button"
        className="admin-btn sm"
        disabled={pending}
        onClick={() => run({ kind: "payment" })}
      >
        {pending ? <LoaderCircle size={14} className="admin-spin" /> : <ShieldCheck size={14} />}
        Mark payment verified
      </button>
      <FormError result={result} />
    </>
  );
}

export function TimelineComposer({ order }: { order: Order }) {
  const { run, pending, result } = useOrderAction(order.id);
  const [kind, setKind] = useState<"note" | "call_logged">("call_logged");
  const [message, setMessage] = useState("");
  return (
    <form
      className="admin-composer"
      onSubmit={(e) => {
        e.preventDefault();
        run({ kind, message }, () => setMessage(""));
      }}
    >
      <div className="admin-composer-kinds" role="radiogroup" aria-label="Entry type">
        {(
          [
            ["call_logged", "Log a call", Phone],
            ["note", "Internal note", StickyNote],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <textarea
        aria-label={kind === "note" ? "Note" : "Call result"}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        maxLength={5000}
        rows={2}
        placeholder={
          kind === "note"
            ? "Visible to the team only"
            : "What happened on the call?"
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <FormError result={result} />
      <div className="admin-composer-foot">
        <button
          type="button"
          className="admin-btn sm"
          disabled={pending}
          onClick={() => run({ kind: "call_logged", message: "No answer" })}
        >
          <PhoneOff size={14} /> No answer
        </button>
        <button className="admin-btn sm dark" disabled={pending || !message.trim()}>
          {pending && <LoaderCircle size={14} className="admin-spin" />}
          Add to timeline
        </button>
      </div>
    </form>
  );
}
