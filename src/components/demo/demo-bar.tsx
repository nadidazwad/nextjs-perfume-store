import { headers } from "next/headers";
import { hasStaleSandboxCookie, requestSandbox } from "@/lib/demo/session";
import { env } from "@/lib/env";
import { DemoBarView } from "./demo-controls";
import "./demo.css";

/** Public demo only (DEMO_MODE): sandbox status and controls across storefront and admin. */
export async function DemoBar({ place }: { place: "store" | "admin" }) {
  if (!env.DEMO_MODE) return null;
  const source = await headers();
  const sandbox = await requestSandbox(source);
  const renderedAt = new Date().getTime(); // the client countdown starts here, so hydration matches
  return (
    <DemoBarView
      place={place}
      expiresAt={sandbox?.expiresAt.toISOString() ?? null}
      renderedAt={renderedAt}
      stale={!sandbox && hasStaleSandboxCookie(source)}
    />
  );
}
