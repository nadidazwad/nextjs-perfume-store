"use client";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LogOut } from "lucide-react";
const auth = createAuthClient();
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <form
      className="admin-login-form"
      // Never GET: if the script hasn't loaded, a native submit must not put the password in the URL.
      method="post"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          const result = await auth.signIn.email({
            email: String(data.get("email")),
            password: String(data.get("password")),
          });
          if (result.error)
            setError(
              "Sign-in failed. Check your credentials or try again shortly.",
            );
          else {
            router.replace("/admin");
            router.refresh();
          }
        } catch {
          setError("Unable to connect. Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="admin-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@store.com"
          required
          maxLength={254}
        />
      </label>
      <label className="admin-field">
        <span>Password</span>
        <span className="admin-input-affix">
          <input
            name="password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            maxLength={128}
          />
          <button
            type="button"
            className="admin-affix-btn"
            onClick={() => setReveal(!reveal)}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>
      {error && (
        <p role="alert" className="admin-callout" data-tone="bad">
          {error}
        </p>
      )}
      <button className="admin-btn primary lg" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle size={16} className="admin-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}
export function Logout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="admin-menu-item danger"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await auth.signOut();
            if (result.error) throw new Error();
            router.replace("/admin/login");
            router.refresh();
          } catch {
            setError("Sign-out failed. Try again.");
            setPending(false);
          }
        }}
      >
        <LogOut size={15} /> {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <span role="alert" className="admin-error-text">
          {error}
        </span>
      )}
    </>
  );
}
