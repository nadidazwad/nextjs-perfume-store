import type { Metadata, Viewport } from "next";
import { StoreHeader, StoreFooter } from "@/components/storefront/shell";
import { MotionPolicy } from "@/components/storefront/motion-policy";
import { CartProvider } from "@/components/storefront/cart-provider";
import { AddedToast, TabBar } from "@/components/storefront/app-shell";
import { DemoBar } from "@/components/demo/demo-bar";
import { storeConfig } from "../../../store.config";
export const dynamic = "force-dynamic";

// Edge-to-edge on notched phones (safe areas are handled in app-shell.css),
// and a home-screen install that opens like an app.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#ffffff",
};
export const metadata: Metadata = {
  appleWebApp: { capable: true, title: storeConfig.store.name, statusBarStyle: "default" },
};

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <MotionPolicy />
      {/* .app-root is the "screen" that recedes behind phone sheets. Fixed
          chrome (tab bar, toast) sits outside it so it stays put. */}
      <div className="app-root">
        <DemoBar place="store" />
        <StoreHeader />
        <main id="main">{children}</main>
        <StoreFooter />
      </div>
      <TabBar />
      <AddedToast />
    </CartProvider>
  );
}
