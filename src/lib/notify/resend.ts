import { env } from "@/lib/env";
import type { NotificationAdapter } from "./types";
export const resendAdapter: NotificationAdapter = {
  async send(subject, text) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.NOTIFY_EMAIL_FROM,
        to: [env.NOTIFY_EMAIL_TO],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new Error(`Email notification failed (${response.status}).`);
  },
};
