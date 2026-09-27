import { appIcon } from "@/components/storefront/app-icon";

// iOS "Add to Home Screen" icon (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default function AppleIcon() {
  return appIcon(180);
}
