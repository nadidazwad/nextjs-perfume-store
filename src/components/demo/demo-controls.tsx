"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { endDemo, resetDemo, resumeDemo, startDemo, type DemoStart } from "@/lib/demo/actions";

/** "1 h 42 m", "12 m", or null once expired. Starts from the server's clock so hydration matches. */
function useTimeLeft(expiresAt: string, renderedAt: number) {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 20_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.ceil((new Date(expiresAt).getTime() - now) / 60_000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes} m`;
  return minutes % 60 ? `${hours} h ${minutes % 60} m` : `${hours} h`;
}

/** Reset / End with an inline confirmation step. */
function SandboxActions({ tone }: { tone: "bar" | "page" }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"reset" | "end" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const run = (which: "reset" | "end") =>
    start(async () => {
      const result = which === "reset" ? await resetDemo() : await endDemo();
      setConfirming(null);
      setMessage(result.ok ? "" : result.message);
      if (which === "end") router.push("/demo?ended=0");
      router.refresh();
    });
  const button = tone === "bar" ? "demo-bar-btn" : "button";
  if (confirming)
    return (
      <span className="demo-actions" role="group" aria-label="Confirm">
        <span className="demo-confirm">
          {confirming === "reset" ? "Start over from the original store?" : "Delete your demo store now?"}
        </span>
        <button type="button" className={`${button} ${tone === "page" ? "primary sm" : "solid"}`} disabled={pending} onClick={() => run(confirming)}>
          {pending ? "Working…" : confirming === "reset" ? "Reset" : "End demo"}
        </button>
        <button type="button" className={`${button} ${tone === "page" ? "ghost sm" : ""}`} disabled={pending} onClick={() => setConfirming(null)}>
          Cancel
        </button>
      </span>
    );
  return (
    <span className="demo-actions">
      <button type="button" className={`${button} ${tone === "page" ? "sm" : ""}`} onClick={() => setConfirming("reset")}>
        Reset
      </button>
      <button type="button" className={`${button} ${tone === "page" ? "sm" : ""}`} onClick={() => setConfirming("end")}>
        End
      </button>
      {message && (
        <span className="demo-confirm" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}

export function DemoBarView({
  place,
  expiresAt,
  renderedAt,
  stale,
}: {
  place: "store" | "admin";
  expiresAt: string | null;
  renderedAt: number;
  stale: boolean;
}) {
  if (!expiresAt)
    return (
      <div className="demo-bar" data-state={stale ? "ended" : "visitor"}>
        <p>
          <span className="demo-dot" aria-hidden />
          {stale ? "Your demo store has ended." : "Demo store: orders aren't real."}
        </p>
        <Link className="demo-bar-btn solid" href="/demo">
          {stale ? "Start a new one" : "Try the admin"}
        </Link>
      </div>
    );
  return <LiveBar place={place} expiresAt={expiresAt} renderedAt={renderedAt} />;
}

function LiveBar({ place, expiresAt, renderedAt }: { place: "store" | "admin"; expiresAt: string; renderedAt: number }) {
  const left = useTimeLeft(expiresAt, renderedAt);
  return (
    <div className="demo-bar" data-state="live">
      <p>
        <span className="demo-dot" aria-hidden />
        <strong>Your demo store</strong>
        <span className="demo-bar-time">{left ? `expires in ${left}` : "has expired"}</span>
      </p>
      <span className="demo-actions">
        {place === "store" && (
          <Link className="demo-bar-btn" href="/admin">
            Admin
          </Link>
        )}
        {left ? <SandboxActions tone="bar" /> : <Link className="demo-bar-btn solid" href="/demo">Start a new one</Link>}
      </span>
    </div>
  );
}

export function RunningSandbox({ expiresAt, renderedAt }: { expiresAt: string; renderedAt: number }) {
  const left = useTimeLeft(expiresAt, renderedAt);
  return (
    <div className="panel demo-running">
      <h2>Your demo store is running</h2>
      <p className="muted">{left ? `It expires in ${left}. Everything in it is deleted then.` : "It has expired."}</p>
      <div className="demo-running-actions">
        <Link className="button primary" href="/admin">
          Open the admin
        </Link>
        <Link className="button" href="/">
          View your storefront
        </Link>
        <SandboxActions tone="page" />
      </div>
    </div>
  );
}

function Copy({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button ghost sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        await navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function DemoStartButton() {
  const [result, setResult] = useState<DemoStart | null>(null);
  const [pending, start] = useTransition();
  if (result?.ok)
    return (
      <div className="panel demo-credentials" aria-live="polite">
        <h2>Your demo store is ready</h2>
        <p className="muted">
          Keep this login to open your demo store on another device. It stops working at{" "}
          {new Date(result.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </p>
        <dl>
          <div>
            <dt>Email</dt>
            <dd className="demo-mono">{result.email}</dd>
            <Copy value={result.email} label="email" />
          </div>
          <div>
            <dt>Password</dt>
            <dd className="demo-mono">{result.password}</dd>
            <Copy value={result.password} label="password" />
          </div>
        </dl>
        <Link className="button primary lg" href="/admin">
          Open the admin
        </Link>
      </div>
    );
  return (
    <div className="demo-start">
      <button
        type="button"
        className="button primary lg"
        disabled={pending}
        onClick={() => start(async () => setResult(await startDemo()))}
      >
        {pending ? "Copying the store for you…" : "Start my demo store"}
      </button>
      {result && !result.ok && (
        <p className="field-error" role="alert">
          {result.message}
        </p>
      )}
    </div>
  );
}

/** /demo/resume: re-attach this signed-in demo session to its sandbox, then open the admin. */
export function ResumeDemo() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    resumeDemo().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        router.replace("/admin");
        router.refresh();
      } else setMessage(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return message ? (
    <div className="demo-start">
      <p className="callout">{message}</p>
      <Link className="button primary" href="/demo">
        Start a new demo store
      </Link>
    </div>
  ) : (
    <p className="muted" role="status">
      Opening your demo store…
    </p>
  );
}
