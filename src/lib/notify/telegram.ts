import { env } from "@/lib/env";
import type { NotificationAdapter } from "./types";
export const telegramAdapter: NotificationAdapter = {
  async send(subject, text) {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `${subject}\n${text}`.slice(0, 4000),
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok || !(await response.json()).ok)
      throw new Error("Telegram notification failed.");
  },
};
