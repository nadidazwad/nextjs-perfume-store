import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { storeConfig } from "../store.config";
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Disabled features 404 before any rendering; the page's own notFound() is
  // the second line of defence.
  if (pathname === "/wishlist" || pathname.startsWith("/wishlist/")) {
    if (!storeConfig.features.wishlist)
      return NextResponse.rewrite(new URL("/_feature-disabled", request.url), { status: 404 });
    return NextResponse.next();
  }
  if (pathname !== "/admin/login" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/wishlist/:path*", "/wishlist"] };
