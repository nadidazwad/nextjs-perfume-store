import { Breadcrumbs } from "@/components/storefront/ui";
import { BrandIndex } from "@/components/storefront/brand-index";
import { getNavigation } from "@/lib/catalog/content";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("Brands", "/brands");
export default async function Brands() {
  const { brands } = await getNavigation();
  return (
    <div className="store-width brand-page">
      <Breadcrumbs items={[["Home", "/"], ["Brands"]]} />
      <header className="listing-header">
        <div>
          <h1>Fragrance houses</h1>
          <p className="listing-description">
            {brands.length} {brands.length === 1 ? "house" : "houses"} in our catalog
          </p>
        </div>
      </header>
      <BrandIndex brands={brands} />
    </div>
  );
}
