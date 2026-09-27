"use client";
import { useId, useState } from "react";
import { CheckCircle2, PenLine, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { submitReview } from "@/lib/reviews/actions";
// The schema pulls in Zod; load it when the dialog opens, not with the PDP.
const loadSchema = () => import("@/lib/reviews/schema").then((m) => m.reviewInputSchema);

type Errors = Record<string, string[] | undefined>;
const words = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function StarInput({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const [hover, setHover] = useState(0);
  const name = useId();
  const shown = hover || value;
  return (
    <fieldset className="star-input" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>
      <legend>
        Your rating <span aria-hidden>*</span>
      </legend>
      <div className="star-input-row" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} data-on={n <= shown || undefined} onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              required
            />
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z" />
            </svg>
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"}, {words[n]}
            </span>
          </label>
        ))}
        <span className="star-input-word" aria-hidden>
          {words[shown] ?? ""}
        </span>
      </div>
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ReviewDialog({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ name: string; verified: boolean } | null>(null);
  const id = useId();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const input = { ...Object.fromEntries(new FormData(form)), rating, productId };
    const parsed = (await loadSchema()).safeParse(input);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors(fields);
      setMessage("");
      const first = ["rating", "name", "phone", "title", "body"].find((f) => fields[f as keyof typeof fields]);
      if (first === "rating") form.querySelector<HTMLInputElement>("input[type=radio]")?.focus();
      else if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setPending(true);
    setErrors({});
    setMessage("");
    try {
      const result = await submitReview(input);
      if (result.ok) setDone({ name: parsed.data.name, verified: result.verified });
      else {
        setMessage(result.message);
        if (result.fields) setErrors(result.fields);
      }
    } catch {
      setMessage("Connection lost. Please try again.");
    } finally {
      setPending(false);
    }
  }
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string; optional?: boolean }) => {
    const { hint, optional, ...rest } = props;
    const error = errors[name]?.[0];
    return (
      <div className="form-field">
        <label htmlFor={`${id}-${name}`}>
          {label}
          {optional ? <span className="muted"> (optional)</span> : <span aria-hidden> *</span>}
        </label>
        <input
          id={`${id}-${name}`}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-${name}-note` : undefined}
          required={!optional}
          {...rest}
        />
        {(error || hint) && (
          <p id={`${id}-${name}-note`} className={error ? "field-error" : "field-hint"}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadSchema();
        if (!next && done) {
          // Start fresh if they open it again for another review.
          setDone(null);
          setRating(0);
        }
      }}
    >
      <DialogTrigger className="button primary">
        <PenLine size={16} aria-hidden /> Write a review
      </DialogTrigger>
      <DialogContent className="store-dialog review-dialog" showCloseButton={false}>
        <div className="store-dialog-head">
          <div>
            <DialogTitle>{done ? "Thank you" : "Write a review"}</DialogTitle>
            <DialogDescription>{done ? productName : `Share your experience with ${productName}.`}</DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Close">
            <X size={18} />
          </DialogClose>
        </div>
        {done ? (
          <div className="review-done" role="status">
            <CheckCircle2 size={36} aria-hidden />
            <p>
              <strong>Thanks, {done.name}.</strong> Your review is with our team and will appear once it&apos;s approved,
              usually within a day.
            </p>
            {done.verified && <p className="muted">We matched your phone number to a delivered order, so it will show a “Verified purchase” badge.</p>}
            <DialogClose className="button">Close</DialogClose>
          </div>
        ) : (
          <form className="review-form" noValidate onSubmit={submit} aria-busy={pending}>
            <StarInput value={rating} onChange={(v) => { setRating(v); setErrors((e) => ({ ...e, rating: undefined })); }} error={errors.rating?.[0]} />
            {field("name", "Your name", { autoComplete: "name", maxLength: 80, hint: "Shown with your review." })}
            {field("phone", "Mobile number", {
              type: "tel",
              autoComplete: "tel",
              maxLength: 30,
              optional: true,
              placeholder: "01XXXXXXXXX",
              hint: "Never shown. Use the number you ordered with to get a “Verified purchase” badge.",
            })}
            {field("title", "Headline", { maxLength: 120, optional: true, placeholder: "Sum it up in a few words" })}
            <div className="form-field">
              <label htmlFor={`${id}-body`}>
                Your review<span aria-hidden> *</span>
              </label>
              <textarea
                id={`${id}-body`}
                name="body"
                rows={5}
                maxLength={2000}
                required
                placeholder="How does it open, how long does it last, when do you wear it?"
                aria-invalid={Boolean(errors.body)}
                aria-describedby={errors.body ? `${id}-body-note` : undefined}
              />
              {errors.body && (
                <p id={`${id}-body-note`} className="field-error">
                  {errors.body[0]}
                </p>
              )}
            </div>
            <div className="checkout-trap" aria-hidden="true">
              <label htmlFor={`${id}-website`}>Website</label>
              <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" maxLength={200} />
            </div>
            {message && (
              <p className="field-error" role="alert">
                {message}
              </p>
            )}
            <div className="review-form-foot">
              <DialogClose className="button ghost" type="button">
                Cancel
              </DialogClose>
              <button className="button primary" disabled={pending}>
                {pending ? "Sending…" : "Submit review"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
