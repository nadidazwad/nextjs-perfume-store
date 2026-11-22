import { z } from "@/lib/zod";
import { SETUP_PLANS } from "./plans";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().transform((v) => v || null);

/** Shared by the /get-your-store form (loaded lazily) and its Server Action. */
export const setupRequestSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep your name under 80 characters."),
  business: z.string().trim().min(1, "Enter your shop or brand name.").max(120, "Keep this under 120 characters."),
  contact: z
    .string()
    .trim()
    .max(120, "Keep this under 120 characters.")
    // A phone number (7+ digits) or an email address: enough to reply to.
    .refine((v) => /@.+\./.test(v) || v.replace(/\D/g, "").length >= 7, "Enter a WhatsApp number or an email address."),
  link: optionalText(300, "Keep the link under 300 characters."),
  plan: z.enum(SETUP_PLANS.map((plan) => plan.value), { error: "Choose what you're looking for." }),
  message: optionalText(1500, "Keep your message under 1,500 characters."),
  /** Honeypot: people never see or fill this. */
  website: z.string().max(200).optional(),
});
export type SetupRequestInput = z.infer<typeof setupRequestSchema>;
