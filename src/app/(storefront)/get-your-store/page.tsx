import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupRequestForm } from "@/components/demo/setup-request-form";
import { env } from "@/lib/env";
import "@/components/demo/demo.css";

export const metadata = {
  title: "Get this store for your perfume shop",
  description:
    "Your own perfume or attar website, set up for you: your brand, your products, Cash on Delivery, bKash and Nagad. No code needed.",
};

const points = [
  ["Your brand, not a template", "Your name, logo and colours throughout, or a design made just for your brand."],
  [
    "Ready to take orders",
    "Your products and prices added, delivery charges set, Cash on Delivery, bKash and Nagad switched on, and new-order alerts on Telegram.",
  ],
  ["Run it from your phone", "Confirm orders, update stock and change the homepage from the admin. I'll show you how."],
] as const;

/** Public demo only (DEMO_MODE): shop owners ask the author to set a store up for them. */
export default function Page() {
  if (!env.DEMO_MODE) notFound();
  return (
    <div className="store-width commerce-page setup-page">
      <div className="setup-pitch">
        <p className="setup-eyebrow">For perfume and attar sellers</p>
        <h1>Get this store for your shop</h1>
        <p className="muted setup-lede">
          Sell from your own website instead of a Messenger inbox. I&apos;ll set this store up for your brand and hand it
          over ready to take orders. You don&apos;t need to touch any code.
        </p>
        <ul className="setup-points">
          {points.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <p className="setup-try">
          Want to see it first? <Link href="/demo">Try the admin</Link> on your own copy of this store, or{" "}
          <Link href="/">browse the shop</Link>.
        </p>
      </div>
      <SetupRequestForm />
    </div>
  );
}
