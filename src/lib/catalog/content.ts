import { cache } from "react";
import { and, asc, desc, eq, isNull, lte, gte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  banners,
  brands,
  collections,
  homepageSections,
  productImages,
  products,
  staticPages,
} from "@/db/schema";
export const getNavigation = cache(async () => {
  const [brandRows, collectionRows, pages] = await Promise.all([
    db.select().from(brands).orderBy(asc(brands.sortOrder), asc(brands.name)),
    db
      .select()
      .from(collections)
      .where(eq(collections.isActive, true))
      .orderBy(asc(collections.sortOrder)),
    db
      .select({ title: staticPages.title, slug: staticPages.slug })
      .from(staticPages)
      .where(eq(staticPages.isActive, true))
      .orderBy(asc(staticPages.title)),
  ]);
  return { brands: brandRows, collections: collectionRows, pages };
});
/** One lead fragrance per brand (featured first, then newest) for the header brand menu. */
export const getBrandSpotlights = cache(async () => {
  const rows = await db
    .selectDistinctOn([products.brandId], {
      brandId: products.brandId,
      name: products.name,
      slug: products.slug,
      imageUrl: productImages.url,
    })
    .from(products)
    .innerJoin(productImages, eq(productImages.productId, products.id))
    .where(eq(products.isActive, true))
    .orderBy(products.brandId, desc(products.isFeatured), desc(products.createdAt), asc(products.id), asc(productImages.sortOrder));
  return new Map(rows.map(({ brandId, ...product }) => [brandId, product]));
});
export const getBanners = cache(async () => {
  const now = new Date();
  return db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.isActive, true),
        or(isNull(banners.startsAt), lte(banners.startsAt, now)),
        or(isNull(banners.endsAt), gte(banners.endsAt, now)),
      ),
    )
    .orderBy(asc(banners.sortOrder));
});
export const getSections = cache(() =>
  db
    .select()
    .from(homepageSections)
    .where(eq(homepageSections.isActive, true))
    .orderBy(asc(homepageSections.sortOrder)),
);
export const getBrand = cache((slug: string) =>
  db.query.brands.findFirst({ where: eq(brands.slug, slug) }),
);
export const getCollection = cache((slug: string) =>
  db.query.collections.findFirst({
    where: and(eq(collections.slug, slug), eq(collections.isActive, true)),
  }),
);
export const getStaticPage = cache((slug: string) =>
  db.query.staticPages.findFirst({
    where: and(eq(staticPages.slug, slug), eq(staticPages.isActive, true)),
  }),
);
