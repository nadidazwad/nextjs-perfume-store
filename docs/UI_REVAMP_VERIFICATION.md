# Storefront UI revamp

Verified 17 September 2026 against the existing seeded catalog.

The storefront now uses warm neutral surfaces, a config-driven olive accent,
a split campaign hero, original fictional fragrance artwork, typographic brand
marks, quieter price badges, and a consistent product presentation across
homepage carousels, listings and detail pages. Category navigation links open
collections directly; the Brands menu retains its disclosure. Existing mobile
sheets, keyboard controls, reduced-motion handling, URL filters and gallery
behavior remain available.

The campaign image is generated artwork, stored locally as a 124 KB WebP.
The SVG fixture generator reproduces all 106 product, brand and collection
illustrations. No third-party image hosting is required. Phosphor storefront
icons use isolated client boundaries where required by the package.

## Checks

- `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed on the final code.
- Two consecutive `pnpm db:seed` runs succeeded and reported preserving the
  existing catalog, stock, orders and credentials.
- `node scripts/verify-storefront.mjs http://127.0.0.1:3000` passed all 61 public
  sitemap URLs, metadata, Product JSON-LD, malformed filters, empty search,
  missing products, robots and the OG image.
- Browser inspection covered home, product listing and product details at
  360 px and desktop, including the final production build.
- Mobile navigation opened and linked to the catalog. Applying the Avenmere
  brand filter reduced 40 results to four and displayed the removable chip.
- Selecting Glass Orchard 100 ml updated its price to ৳1,755 and its SKU to
  DEMO-GLASS-ORCHARD-100. Image 2 selected correctly; the lightbox opened and
  accepted Escape. Checked mobile pages had no horizontal overflow.

The production preview uses `NODE_ENV=test pnpm start --hostname 127.0.0.1
--port 3000` for local PGlite, consistent with the existing Phase 2 verification.
Cart and checkout remain outside the implemented catalog phase. No new
Lighthouse audit was performed. The workspace exposes no usable Git metadata,
so this change was not committed.

## Follow-up cleanup

Removed decorative homepage eyebrow labels and the header's extra tagline,
changed section links to "View all", removed animated link/navigation
underlines and category hover zoom, and replaced the wishlist's blur/scale
transition with a direct outlined/filled icon. Kept functional headings,
ordinary link underlines, keyboard focus, drawer/gallery transitions and press
feedback. Deleted the associated unused styles.

Final lint, typecheck, production build and two seed runs passed. Browser
checks confirmed the desktop and 360 px homepage layout without horizontal
overflow, absent underline pseudo-elements, and wishlist save/remove states.

## Navigation and product-card refinement — 2026-09-17

- Desktop navigation now uses a prominent catalog entry, 16px links, and an expanded brand directory with larger names and two featured images. Mobile drawer markup and behavior are preserved.
- Product cards use larger names and prices, distinct concentration/size rows, and an unobtrusive link reveal on pointer hover or keyboard focus. Alternate-image previews remain.
- Brand panel entry takes 180ms for pointer input. Keyboard and reduced-motion handling remain in place. No animated underlines were added.
- Browser checked at 1440px, 900px and 360px. No overflow at desktop or 360px; mobile menu selection closes the drawer and navigates. Escape closes the desktop panel and returns focus to its summary. Keyboard focus reveals the product affordance.
- Lint, typecheck, production build and two consecutive seed runs passed before the final loading-image aspect-ratio alignment. Final build rechecked after that CSS adjustment.

## Mobile hamburger menu refinement — 2026-09-19

- Added a fixed store-name header and 44px close control, a prominent catalog link, 26px collection links, and a separate expandable brand directory. The drawer body scrolls independently and respects device safe areas.
- Preserved native disclosure controls, modal focus handling, and close-on-navigation. Disclosure icons and content use brief pointer-only motion with reduced-motion overrides.
- Corrected the inherited pseudo-element that duplicated the open-state disclosure indicator.
- Verified at 360px: no horizontal overflow, expandable brand list scrolls, selecting Vellune House navigates and closes the drawer, and Escape returns focus to Open menu. At 1440px the desktop navigation remains visible without overflow.
- Lint, typecheck and production build passed after the final correction. Two consecutive seed runs passed during this mobile-menu update.
