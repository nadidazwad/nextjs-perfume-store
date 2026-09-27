import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteUrl } from "@/lib/seo";
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Render per request so the sitemap URL follows NEXT_PUBLIC_APP_URL at
  // runtime (Docker images are built before the store URL is known).
  await connection();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/search",
        "/cart",
        "/checkout",
        "/order",
        "/track-order",
        "/wishlist",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
