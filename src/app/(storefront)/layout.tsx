import { StoreHeader, StoreFooter } from "@/components/storefront/shell";
import { MotionPolicy } from "@/components/storefront/motion-policy";
import { CartProvider } from "@/components/storefront/cart-provider";
export const dynamic = "force-dynamic";
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <MotionPolicy />
      <StoreHeader />
      <main id="main">{children}</main>
      <StoreFooter />
    </CartProvider>
  );
}
