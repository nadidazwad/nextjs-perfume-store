# Jomashop UX Research Notes

> Field notes from inspecting jomashop.com (homepage, `/fragrances.html` PLP, and a
> Creed Aventus PDP) on 2026-09-16. These findings drive the storefront spec in
> `docs/SPEC.md`. Where Jomashop's pattern doesn't fit a manual-payment Bangladesh
> store, the adaptation is noted.

## 1. Global layout

Observed, top to bottom:

1. **Trust strip** (very top): "1,350,000+ HAPPY CUSTOMERS | ⭐⭐⭐⭐⭐ | ONLINE SINCE 1999"
2. **Announcement bars**: up to 3 stacked rotating promo messages, each linking to a
   sale page ("END OF SUMMER SALE — SHOP NOW", "DOORBUSTERS | LIMITED QUANTITIES").
3. **Contact strip**: "Chat or Call (877) 834-1434" — phone prominently placed.
   → Adaptation: for BD this is *more* important; make phone + WhatsApp buttons
   first-class in the header.
4. **Header**: logo left, search center, currency selector, Sign in, Wishlist(count),
   Bag(count).
5. **Primary nav**: single row of top categories (Shop By Brand, Men, Women, …, Sale).
   Hover opens mega menu panels.
6. **Sub-promo banner** below nav (image banner linking to sale).
7. **Footer**: help links, policies, newsletter, social.

Cart and wishlist open as **slide-out drawers**, not separate pages, with empty-state
messaging ("Your shopping bag is empty. Let's go buy something!").

## 2. Homepage anatomy

Order of sections observed:

1. Hero banner (campaign)
2. **Brand quick-link chips** (Omega, Rolex, … All Brands) — horizontally scrollable
3. **Shop by Category** grid — image tiles
4. **Sales & Events** card grid — image + title + subtitle ("Up to 50% Off"), fully
   CMS-driven, ~6-24 cards
5. **Limited Time Offers** — same card pattern, more cards
6. **Featured Daily Deals** — 4 product cards with full price display
7. **Value props band** — Authenticity / Warranty / Fast & Easy Returns / Never Pay
   Retail, each with expandable blurb + "1,350,000+ five star reviews, 10M packages"
8. **Featured Brands for Men / Women** — link lists with lifestyle image
9. **Trending Now** — tabbed product carousel (Watches | Fragrances | … ) with
   "Shop All X" links
10. Latest blog posts

→ Adaptation: every section becomes an admin-manageable "homepage section" with a
type (hero, category-tiles, event-cards, product-carousel, value-props, brand-strip).

## 3. Product listing page (PLP) — `/fragrances.html`

- Breadcrumb + H1 + **result count** ("26,520 results") + sort dropdown
  (default "Best Sellers").
- **Category visual tiles** above the grid: For Him, For Her, Niche, Designer,
  Middle Eastern, Testers, Samples, Minis, Celebrity Scents, Gift Sets.
- **Filter sidebar** (fragrances vertical), in order:
  - Coupon Offers (toggle), Get It Fast (toggle)
  - Price (range)
  - **Fragrance Notes Group** (e.g. woody, fresh…)
  - **Fragrance Packaging** (Tester / Sample / Mini / Gift Set)
  - **Fragrance Family**
  - Department, **Brand Type** (Niche / Designer / Middle Eastern / Celebrity)
  - **Brand** — alphabet index (a–z, #) + checkbox list with "See More", hundreds
    of brands
  - **Gender** (Mens / Womens / Unisex)
  - **Fragrance Size**, Category, **Type** (EDT/EDP/Parfum), Base (Spray/Oil)
- Filters combine via URL query params; selections shown and removable.
- **Product card**:
  - Image, swaps to 2nd image on hover
  - Brand name (bold) + full product title
  - "% Off" badge (red), `Reg.$80.00` strikethrough, `Now:$35.99`
  - Coupon line where applicable: "$10.00 coupon" + "$25.99 after coupon"
  - Scarcity tag: "Limited Quantity"
  - Wishlist heart
- Inline **promo cards** mixed into the grid every ~2 rows.
- Pagination (numbered + next), not infinite scroll.

→ Adaptations:
- Coupon-stacking display ("after coupon" price) is a Jomashop signature — v2
  feature tied to coupons.
- "Get It Fast" → skip (no courier SLA data). "Testers" packaging → keep; testers
  are a big deal in BD fragrance retail.

## 4. Product detail page (PDP) — Creed Aventus

- Breadcrumb: Home > Fragrances > Creed Fragrances > Aventus > product.
- **Left**: image gallery — main image + thumbnail strip (4+ images), zoom.
- **Right (buy box)**, in order:
  1. Brand (linked) + product title + "Item No. 3508441001114"
  2. `IN STOCK` badge + `36% Off` badge
  3. Coupon callout: `$50.00 coupon w/code "EXTRA50"`
  4. Price stack: `Retail $510.00` (struck) / `Asking $375.00` / `$325.00 after coupon`
  5. Size row: "Size: 3.3 oz / 100 ml" (variant selector when multiple)
  6. Shipping promise ("Want it by Thursday? Order within 4 hrs 3 mins")
  7. **Authenticity Guaranteed** trust block with link
  8. Add to bag / wishlist
- **Description**: 3-4 rich paragraphs; explicitly narrates **top / heart / base
  notes** in prose. SKU + barcode line at the end.
- **Product Details** spec table, grouped: Brand, Brand Type (Niche), Collection
  Name, Gender, Model, Size, Type (Eau de Parfum), Base (Spray), Department, UPC.
- Related products carousel.

→ Adaptations:
- "Order within X hrs" countdown → replace with honest BD promise: "Order today,
  our team calls you within hours" + delivery ETA per zone from config.
- Notes narrated in prose AND stored structured (top/heart/base) so they power
  filters + a notes pyramid UI — this is where we can *beat* Jomashop's PDP.

## 5. Pricing display language

Jomashop's core merchandising pattern, used identically on cards and PDP:

```
[% Off badge]  Reg.$510.00 (struck)   Now:$375.00
$50.00 coupon
$325.00 after coupon
```

Also seen: "Earn $5 Credit" (loyalty — out of scope), percent coupons ("20% coupon").

## 6. Product data model implied by observation

Every fragrance product exposes: brand, brand type (Niche/Designer/Middle
Eastern/Celebrity), collection/series (e.g. "Aventus"), gender (Mens/Womens/
Unisex), concentration type (EDT/EDP/Parfum/Extrait), base (Spray/Oil/Solid),
packaging (Standard/Tester/Sample/Mini/Gift Set), size (oz + ml), fragrance
family, notes groups, UPC/barcode, SKU, retail price, asking price, coupon,
stock status, scarcity flag, 2+ images.

## 7. Features deliberately NOT copied

| Jomashop feature | Why skipped |
|---|---|
| Real payment checkout | Template is manual-confirmation (COD/bKash) by design |
| Multi-currency selector | Single-currency config in v1 |
| Loyalty credits ("Earn $5") | Out of scope |
| App-download banners | No app |
| Live chat vendor | Replaced with WhatsApp deep link |
| "Get It Fast" filter | No courier SLA integration in v1 |
| Blog | Out of scope v1; nav slot reserved |
| Pre-owned dept | Not applicable |
