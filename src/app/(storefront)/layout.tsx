import { StoreHeader, StoreFooter } from "@/components/storefront/shell";
import { MotionPolicy } from "@/components/storefront/motion-policy";
import { CartProvider } from "@/components/storefront/cart-provider";
import { DemoBar } from "@/components/demo/demo-bar";
export const dynamic = "force-dynamic";
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <MotionPolicy />
      <DemoBar place="store" />
      <StoreHeader />
      <main id="main">{children}</main>
      <StoreFooter />
    </CartProvider>
  );
}
