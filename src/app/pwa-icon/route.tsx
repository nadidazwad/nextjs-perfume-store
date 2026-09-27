import { appIcon } from "@/components/storefront/app-icon";

// Icons for the web app manifest (src/app/manifest.ts): /pwa-icon?size=192 or 512.
export function GET(request: Request) {
  const size = new URL(request.url).searchParams.get("size") === "512" ? 512 : 192;
  const response = appIcon(size);
  response.headers.set("Cache-Control", "public, max-age=86400");
  return response;
}
