import { notFound } from "next/navigation";
import { ProductListing } from "@/components/storefront/product-listing";
import { getCollection } from "@/lib/catalog/content";
import { pageMetadata } from "@/lib/seo";
import type { SearchParams } from "@/lib/catalog/params";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params }: Props) {
  const c = await getCollection((await params).slug);
  return c
    ? pageMetadata(
        c.name,
        `/c/${c.slug}`,
        c.description ?? undefined,
        c.heroImageUrl ?? undefined,
      )
    : {};
}
export default async function Collection({ params, searchParams }: Props) {
  const c = await getCollection((await params).slug);
  if (!c) notFound();
  return (
    <ProductListing
      title={c.name}
      description={c.description}
      path={`/c/${c.slug}`}
      searchParams={await searchParams}
      scope={c.filterJson}
    />
  );
}
