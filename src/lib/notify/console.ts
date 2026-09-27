import type { NotificationAdapter } from "./types";
export const consoleAdapter: NotificationAdapter = {
  async send(subject, text) {
    console.info(`[Attar notification] ${subject}\n${text}`);
  },
};
