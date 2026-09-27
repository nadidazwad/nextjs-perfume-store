import { env } from "@/lib/env";

/** Public demo: visitor-typed outbound links render as user content. Server components only. */
export const ugcRel = (href?: string | null) =>
  env.DEMO_MODE && href && /^https?:\/\//i.test(href) ? "nofollow ugc" : undefined;
