import { ProductListing } from "@/components/storefront/product-listing";
import { SearchForm } from "@/components/storefront/shell-controls";
import { parseCatalogParams, type SearchParams } from "@/lib/catalog/params";
import { pageMetadata } from "@/lib/seo";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q } = parseCatalogParams(await searchParams);
  return {
    ...pageMetadata(q ? `Search: ${q}` : "Search", "/search"),
    robots: { index: false, follow: true },
  };
}
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams,
    { q } = parseCatalogParams(raw);
  return (
    <>
      <div className="store-width search-page-form">
        <SearchForm className="page-search" />
      </div>
      <ProductListing
        title={q ? `Results for "${q}"` : "Search fragrances"}
        path="/search"
        searchParams={raw}
      />
    </>
  );
}
