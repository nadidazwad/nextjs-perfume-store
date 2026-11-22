"use client";
import { useEffect, useId, useRef, useState } from "react";
import { SuccessMark } from "@/components/storefront/ui";
import { submitSetupRequest } from "@/lib/setup-requests/actions";
import { SETUP_PLANS, type SetupPlan } from "@/lib/setup-requests/plans";
// The schema pulls in Zod; load it on first focus, not with the page.
const loadSchema = () => import("@/lib/setup-requests/schema").then((m) => m.setupRequestSchema);

type Errors = Record<string, string[] | undefined>;
const order = ["name", "business", "contact", "link", "plan", "message"];

/** /get-your-store (DEMO_MODE only): a shop owner asks for their own store. */
export function SetupRequestForm() {
  const id = useId();
  const [plan, setPlan] = useState<SetupPlan>("setup");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const thanks = useRef<HTMLDivElement>(null);
  // The form is taller than the thank-you note: bring the note into view.
  useEffect(() => {
    if (done) thanks.current?.scrollIntoView({ block: "center" });
  }, [done]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const input = { ...Object.fromEntries(new FormData(form)), plan };
    const parsed = (await loadSchema()).safeParse(input);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors(fields);
      setMessage("");
      const first = order.find((name) => fields[name as keyof typeof fields]);
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setPending(true);
    setErrors({});
    setMessage("");
    try {
      const result = await submitSetupRequest(input);
      if (result.ok) setDone(parsed.data.name);
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

  if (done)
    return (
      <div className="panel setup-done" role="status" ref={thanks}>
        <SuccessMark size={40} />
        <h2>Thanks, {done}</h2>
        <p className="muted">
          Your request is in. I&apos;ll reply on the number or email you gave to talk about your shop. Meanwhile, try the
          admin to see how running the store feels.
        </p>
        <a className="button" href="/demo">
          Try the admin
        </a>
      </div>
    );

  const note = (name: string, hint?: string) => {
    const error = errors[name]?.[0];
    if (!error && !hint) return null;
    return (
      <p id={`${id}-${name}-note`} className={error ? "field-error" : "field-hint"}>
        {error ?? hint}
      </p>
    );
  };
  const described = (name: string, hint?: string) =>
    errors[name] || hint ? `${id}-${name}-note` : undefined;
  const field = (
    name: string,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string; optional?: boolean },
  ) => {
    const { hint, optional, ...rest } = props;
    return (
      <div className="form-field">
        <label htmlFor={`${id}-${name}`}>
          {label}
          {optional ? <span className="muted"> (optional)</span> : <span aria-hidden> *</span>}
        </label>
        <input
          id={`${id}-${name}`}
          name={name}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={described(name, hint)}
          required={!optional}
          {...rest}
        />
        {note(name, hint)}
      </div>
    );
  };

  return (
    <form className="panel setup-form" noValidate onSubmit={submit} onFocus={() => void loadSchema()} aria-busy={pending}>
      <h2>Tell me about your shop</h2>
      {field("name", "Your name", { autoComplete: "name", maxLength: 80 })}
      {field("business", "Shop or brand name", { autoComplete: "organization", maxLength: 120 })}
      {field("contact", "WhatsApp number or email", {
        autoComplete: "tel",
        maxLength: 120,
        hint: "I'll reply here. It's only used to get back to you.",
      })}
      {field("link", "Facebook page, Instagram or website", {
        optional: true,
        inputMode: "url",
        maxLength: 300,
        placeholder: "facebook.com/yourshop",
      })}
      <fieldset
        className="payment-methods setup-plans"
        aria-invalid={Boolean(errors.plan)}
        aria-describedby={described("plan")}
      >
        <legend>What are you looking for?</legend>
        {SETUP_PLANS.map((option) => (
          <label key={option.value} data-selected={option.value === plan}>
            <input
              type="radio"
              name="plan"
              value={option.value}
              checked={option.value === plan}
              onChange={() => setPlan(option.value)}
            />
            <span>
              <strong>{option.title}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
        {note("plan")}
      </fieldset>
      <div className="form-field">
        <label htmlFor={`${id}-message`}>
          Anything else?<span className="muted"> (optional)</span>
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={4}
          maxLength={1500}
          placeholder="What you sell, roughly how many products, when you'd like to launch"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={described("message")}
        />
        {note("message")}
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
      <button className="button primary lg" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </button>
      <p className="field-hint">No payment now. I&apos;ll get in touch to talk about your shop and send a quote.</p>
    </form>
  );
}
