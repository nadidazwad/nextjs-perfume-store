import Link from "next/link";
import { storeConfig } from "../../store.config";
export default function NotFound() {
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
