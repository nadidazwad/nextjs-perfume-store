import { Homepage } from "@/components/storefront/homepage";
import { pageMetadata, absoluteUrl, jsonLd } from "@/lib/seo";
import { storeConfig } from "../../../store.config";
export const metadata = {
  ...pageMetadata(storeConfig.store.name, "/"),
  title: { absolute: storeConfig.store.name },
};
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: storeConfig.store.name,
            url: absoluteUrl("/"),
            telephone: storeConfig.contact.phone,
            ...(storeConfig.store.logo
              ? { logo: absoluteUrl(storeConfig.store.logo) }
              : {}),
          }),
        }}
      />
      <Homepage />
    </>
  );
}
