import { notFound } from "next/navigation";
import { ProductListing } from "@/components/storefront/product-listing";
import { Media } from "@/components/storefront/media";
import { getBrand } from "@/lib/catalog/content";
import { pageMetadata } from "@/lib/seo";
import type { SearchParams } from "@/lib/catalog/params";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params }: Props) {
  const brand = await getBrand((await params).slug);
  return brand
    ? pageMetadata(
        brand.name,
        `/brands/${brand.slug}`,
        brand.description ?? undefined,
        brand.heroImageUrl ?? undefined,
      )
    : {};
}
export default async function Brand({ params, searchParams }: Props) {
  const b = await getBrand((await params).slug);
  if (!b) notFound();
  return (
    <ProductListing
      title={b.name}
      description={b.description}
      path={`/brands/${b.slug}`}
      searchParams={await searchParams}
      scope={{ brand: [b.slug] }}
      crumbs={[["Home", "/"], ["Brands", "/brands"], [b.name]]}
      hero={
        <Media
          src={b.logoUrl ?? b.heroImageUrl}
          alt={b.name}
          sizes="200px"
        />
      }
    />
  );
}
