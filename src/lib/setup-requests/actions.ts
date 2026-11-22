"use server";
import { headers } from "next/headers";
import { publicDb } from "@/db";
import { setupRequests } from "@/db/schema";
import { env } from "@/lib/env";
import { notifyOperator } from "@/lib/notify";
import { clientIp, takeRateLimit } from "@/lib/rate-limit";
import { setupPlanTitle } from "./plans";
import { setupRequestSchema } from "./schema";

export type SetupRequestResult =
  | { ok: true }
  | { ok: false; message: string; fields?: Record<string, string[] | undefined> };

/** /get-your-store (public demo only): a shop owner asks for a store to be set up for them. */
export async function submitSetupRequest(input: unknown): Promise<SetupRequestResult> {
  if (!env.DEMO_MODE) return { ok: false, message: "This form isn't available." };
  if (!(await takeRateLimit("setup-request-ip", clientIp(await headers()), 3, 60 * 60_000)))
    return { ok: false, message: "You've sent a few requests already. Please try again in an hour." };
  const parsed = setupRequestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Check the highlighted fields.", fields: parsed.error.flatten().fieldErrors };
  const { website, ...data } = parsed.data;
  // Bots fill every field. Pretend success so they don't retry.
  if (website) return { ok: true };
  try {
    // publicDb: a visitor with a demo sandbox must still reach the real inbox.
    const [row] = await publicDb.insert(setupRequests).values(data).returning({ id: setupRequests.id });
    await notifyOperator(
      "New store setup request",
      [
        `${data.business}: ${data.name} | ${data.contact}`,
        `Wants: ${setupPlanTitle(data.plan)}`,
        ...(data.link ? [`Link: ${data.link}`] : []),
        ...(data.message ? [data.message] : []),
        `${env.NEXT_PUBLIC_APP_URL}/admin/setup-requests#${row.id}`,
      ].join("\n"),
      `${env.NEXT_PUBLIC_APP_URL}/admin/setup-requests`,
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "We couldn't send your request. Please try again." };
  }
}
