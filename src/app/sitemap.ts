import type { MetadataRoute } from "next";
import { db } from "@/db";
import { products, brands, collections, staticPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { absoluteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await Promise.all([
    db
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .where(eq(products.isActive, true)),
    db.select({ slug: brands.slug, updatedAt: brands.updatedAt }).from(brands),
    db
      .select({ slug: collections.slug, updatedAt: collections.updatedAt })
      .from(collections)
      .where(eq(collections.isActive, true)),
    db
      .select({ slug: staticPages.slug, updatedAt: staticPages.updatedAt })
      .from(staticPages)
      .where(eq(staticPages.isActive, true)),
  ]);
  return [
    ...["/", "/products", "/brands"].map((path) => ({
      url: absoluteUrl(path),
    })),
    ...rows.flatMap((group, i) =>
      group.map((r) => ({
        url: absoluteUrl(
          `/${["products", "brands", "c", "pages"][i]}/${r.slug}`,
        ),
        lastModified: r.updatedAt,
      })),
    ),
  ];
}
