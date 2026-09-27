import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { storeConfig } from "../store.config";
import { pagePolicy } from "./lib/csp";

/**
 * Per-request script nonce: only Next's own scripts (which it tags with the
 * nonce) and what they load may run. The page policy replaces the base one
 * from next.config.ts, so it repeats those directives (src/lib/csp.ts).
 */
function withScriptPolicy(request: NextRequest, response?: (headers: Headers) => NextResponse) {
  const nonce = btoa(crypto.randomUUID());
  const policy = pagePolicy(nonce);
  // Next reads the nonce from the request's policy while rendering.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const result = response ? response(headers) : NextResponse.next({ request: { headers } });
  result.headers.set("Content-Security-Policy", policy);
  return result;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Disabled features 404 before any rendering; the page's own notFound() is
  // the second line of defence.
  if (pathname === "/wishlist" || pathname.startsWith("/wishlist/")) {
    if (!storeConfig.features.wishlist)
      return withScriptPolicy(request, (headers) =>
        NextResponse.rewrite(new URL("/_feature-disabled", request.url), { status: 404, request: { headers } }),
      );
  } else if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return withScriptPolicy(request);
}

export const config = {
  matcher: [
    {
      // Pages only: not APIs, build assets, images, uploads or files with an extension.
      source: "/((?!api|_next/static|_next/image|uploads/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
