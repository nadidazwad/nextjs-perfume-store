import type { MetadataRoute } from "next";
import { storeConfig } from "../../store.config";

/**
 * Lets shoppers install the store to their home screen; it then opens full
 * screen like an app, and the phone app shell (app-shell.css) takes over.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: storeConfig.store.name,
    short_name: storeConfig.store.name.length > 12 ? storeConfig.store.name.split(/\s+/)[0] : storeConfig.store.name,
    description: storeConfig.seo.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
