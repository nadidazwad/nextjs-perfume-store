# New-order alerts: Telegram or email

When a customer places an order, Attar tells your team so someone can call
and confirm it. Choose one adapter with `NOTIFY_ADAPTER`:

| `NOTIFY_ADAPTER` | Where alerts go | Cost |
|---|---|---|
| `console` (default) | the server log | free, nothing to set up |
| `telegram` | a Telegram chat or group | free |
| `resend` | email via [Resend](https://resend.com) | free up to 3,000 emails a month |

A failed alert never blocks an order. The order is saved first, and a failure
is logged without provider details. In production, the `console` adapter logs
only the order number, total and admin link, not the customer's name, phone
or address.

After you change adapters, open **Admin → Settings** and press **Send test
notification**.

## Telegram (recommended for Bangladesh teams)

1. In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`,
   and follow the prompts. Copy the **token** it gives you, which looks like
   `123456789:AA…`.
2. Create a group for your order team and add the bot to it. Send any message
   in the group so the bot sees the chat.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser, with
   your token in place of `<TOKEN>`. Find `"chat":{"id": …}` for your group.
   Group IDs are negative, like `-1001234567890`. If the result is empty, send
   another message in the group and reload.
4. Set the variables and redeploy:

   ```bash
   NOTIFY_ADAPTER=telegram
   TELEGRAM_BOT_TOKEN=123456789:AA…
   TELEGRAM_CHAT_ID=-1001234567890
   ```

Each alert has the order number, customer name and phone, address, items,
total, payment method with TrxID, and a link to the order in the admin.

## Email with Resend

1. Create a [Resend](https://resend.com) account and an API key (**API Keys →
   Create**, *Sending access*).
2. Choose the sender:
   - **Quick start:** use `onboarding@resend.dev` as the sender. Resend then
     only delivers to the email address on your Resend account, which is
     enough when alerts go to you.
   - **Your domain:** add and verify your domain under **Domains** (a few DNS
     records), then send from an address on it, such as
     `orders@your-shop.com`, to any team inbox.
3. Set the variables and redeploy:

   ```bash
   NOTIFY_ADAPTER=resend
   RESEND_API_KEY=re_…
   NOTIFY_EMAIL_FROM=onboarding@resend.dev
   NOTIFY_EMAIL_TO=you@example.com
   ```

The free plan allows 100 emails a day, which covers 100 orders a day.
