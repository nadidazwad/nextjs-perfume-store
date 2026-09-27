import Link from "next/link";
import { connection } from "next/server";
import { storeConfig } from "../../store.config";
export default async function NotFound() {
  // Rendered per request so its scripts get the CSP nonce (src/proxy.ts).
  await connection();
  return (
    <main className="store-width empty-state">
      <Link href="/" className="store-logo">
        {storeConfig.store.name}
      </Link>
      <h1>Page not found</h1>
      <p>This page may have moved or is no longer available.</p>
      <Link href="/products" className="button primary">
        Browse fragrances
      </Link>
    </main>
  );
}
