import { notFound } from "next/navigation";
import { ResumeDemo } from "@/components/demo/demo-controls";
import { env } from "@/lib/env";
import "@/components/demo/demo.css";

export const metadata = { title: "Opening your demo store", robots: { index: false, follow: false } };

/** requireAdmin sends a signed-in demo visitor here when this browser has no sandbox cookie yet. */
export default function Page() {
  if (!env.DEMO_MODE) notFound();
  return (
    <div className="store-width commerce-page demo-page">
      <h1>Your demo store</h1>
      <ResumeDemo />
    </div>
  );
}
