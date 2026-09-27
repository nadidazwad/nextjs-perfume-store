import type { Metadata } from "next";
import { storeConfig } from "../../store.config";
export const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export function pageMetadata(
  title: string,
  path: string,
  description = storeConfig.seo.description,
  image = storeConfig.seo.ogImage,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      images: [{ url: image }],
      siteName: storeConfig.store.name,
    },
  };
}
export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
