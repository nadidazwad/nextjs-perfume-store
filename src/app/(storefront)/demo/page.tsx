import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DemoStartButton, RunningSandbox } from "@/components/demo/demo-controls";
import { hasStaleSandboxCookie, requestSandbox } from "@/lib/demo/session";
import { SANDBOX_TTL_MS } from "@/lib/demo/sandbox";
import { env } from "@/lib/env";
import "@/components/demo/demo.css";

export const metadata = { title: "Try the admin", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: PageProps<"/demo">) {
  if (!env.DEMO_MODE) notFound();
  const source = await headers();
  const sandbox = await requestSandbox(source);
  const { ended } = await searchParams;
  const hours = SANDBOX_TTL_MS / 3_600_000;
  const renderedAt = new Date().getTime();
  return (
    <div className="store-width commerce-page demo-page">
      <h1>Try the admin</h1>
      <p className="muted demo-lede">
        Get your own copy of this store for {hours} hours. Edit products, confirm and ship orders, rearrange the
        homepage, then see the result in the shop. Nobody else sees your changes.
      </p>
      {sandbox ? (
        <RunningSandbox expiresAt={sandbox.expiresAt.toISOString()} renderedAt={renderedAt} />
      ) : (
        <>
          {(ended === "1" || hasStaleSandboxCookie(source)) && (
            <p className="callout demo-notice">Your previous demo store has ended and was deleted.</p>
          )}
          {ended === "0" && <p className="callout demo-notice">Your demo store was deleted. Thanks for trying it.</p>}
          <DemoStartButton />
        </>
      )}
      <ul className="demo-points">
        <li>
          <strong>Private</strong>
          <p>Your changes appear only for you: in this browser, or wherever you sign in with your demo login.</p>
        </li>
        <li>
          <strong>Gone in {hours} hours</strong>
          <p>Your copy, your demo login and anything you typed are deleted automatically. You can end it sooner.</p>
        </li>
        <li>
          <strong>Make things up</strong>
          <p>Use invented names and phone numbers. Nothing is sent anywhere: order alerts stay in the server log.</p>
        </li>
      </ul>
    </div>
  );
}
