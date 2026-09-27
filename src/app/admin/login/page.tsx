import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { adminSession } from "@/lib/admin/session";
import { LoginForm } from "@/components/admin/auth-controls";
import { storeConfig } from "../../../../store.config";
export default async function Login() {
  if (await adminSession()) redirect("/admin");
  return (
    <main className="admin-login">
      <section className="admin-login-art" aria-hidden>
        <Image
          src="/editorial/fragrance-still-life.webp"
          alt=""
          fill
          fetchPriority="high"
          sizes="(max-width: 900px) 0px, 50vw"
        />
        <div className="admin-login-art-copy">
          <span className="admin-wordmark light">
            {storeConfig.store.name}
            <sup>©</sup>
          </span>
          <p>Orders, catalog and storefront, in one calm place.</p>
        </div>
      </section>
      <section className="admin-login-pane">
        <Link href="/" className="admin-login-back">
          {storeConfig.store.name} <ArrowUpRight size={14} />
        </Link>
        <div className="admin-login-card">
          <span className="admin-eyebrow">Store administration</span>
          <h1>Welcome back</h1>
          <p className="admin-muted">
            Sign in to confirm today&apos;s orders and manage your catalog.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
