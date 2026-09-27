"use client";
import { storeConfig } from "../../store.config";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="store-width empty-state">
      <p className="store-logo">{storeConfig.store.name}</p>
      <h1>We could not load this page</h1>
      <p>Please try again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
