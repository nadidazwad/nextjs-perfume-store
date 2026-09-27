import { notFound } from "next/navigation";
import { WishlistPage } from "@/components/storefront/wishlist";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import { Breadcrumbs } from "@/components/storefront/ui";
import { storeConfig } from "../../../../store.config";

export const metadata = { title: "Wishlist", robots: { index: false, follow: true } };

export default function Page() {
  if (!storeConfig.features.wishlist) notFound();
  return (
    <div className="store-width listing-page wishlist-page">
      <Breadcrumbs items={[["Home", "/"], ["Wishlist"]]} />
      <WishlistPage />
      {storeConfig.features.recentlyViewed && <RecentlyViewed />}
    </div>
  );
}
