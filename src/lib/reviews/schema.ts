import { z } from "@/lib/zod";
import { isValidPhone, normalizePhone } from "@/lib/phone";

/** Pure review helpers shared by the storefront form, the Server Action and tests. */
export const reviewInputSchema = z.object({
  productId: z.string().min(1).max(100),
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep your name under 80 characters."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .refine((v) => !v || isValidPhone(v), "Enter a valid Bangladesh mobile number, or leave it empty.")
    .transform((v) => (v ? normalizePhone(v) : null)),
  rating: z.coerce
    .number({ error: "Choose a star rating." })
    .int("Choose a star rating.")
    .min(1, "Choose a star rating.")
    .max(5, "Choose a star rating."),
  title: z
    .string()
    .trim()
    .max(120, "Keep the title under 120 characters.")
    .optional()
    .transform((v) => v || null),
  body: z
    .string()
    .trim()
    .min(10, "Write at least a sentence (10 characters).")
    .max(2000, "Keep your review under 2,000 characters."),
  /** Honeypot: people never see or fill this. */
  website: z.string().max(200).optional(),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export type RatingSummary = {
  count: number;
  /** Average rounded to one decimal, 0 when there are no reviews. */
  average: number;
  /** Counts indexed 5 → 1. */
  distribution: { stars: 5 | 4 | 3 | 2 | 1; count: number; percent: number }[];
};

export function summarizeRatings(counts: Partial<Record<number, number>>): RatingSummary {
  const stars = [5, 4, 3, 2, 1] as const;
  const count = stars.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const total = stars.reduce((sum, s) => sum + s * (counts[s] ?? 0), 0);
  return {
    count,
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    distribution: stars.map((s) => ({
      stars: s,
      count: counts[s] ?? 0,
      percent: count ? Math.round(((counts[s] ?? 0) / count) * 100) : 0,
    })),
  };
}
