# Design system

Attar's storefront and admin panel share one visual language: a white canvas,
soft grey rounded panels, white fields, pill buttons and small icon tiles.
Colour is reserved for the brand accent and for state (stock, order status,
deals), and state colour always comes with a text label.

## Customising the storefront

Work from the outside in. Most stores only need step 1.

1. **`store.config.ts` → `theme`**
   - `primary`: buttons, the announcement bar, the feature banner and selected filters.
   - `deal`: discount badges and the "Deals" link.
   - `radius`: `none` makes every corner square; `sm`/`md`/`lg` round panels,
     cards and pills proportionally.
2. **Tokens at the top of `src/app/storefront.css`**
   - Neutrals (`--sf-panel`, `--sf-line`…), page width, section spacing, and
     `--sf-product-ratio`. Set that to match your product photos, e.g. `1 / 1`
     for square shots.
3. **Homepage order and content**: Admin → Homepage (drag to reorder) and
   Admin → Banners. No code needed.
4. **Components**: `src/components/storefront/`. Keep class names; the
   stylesheet is organised by section (`=== HOMEPAGE`, `=== PRODUCT CARD`,
   `=== PRODUCT PAGE`…).

When asking an AI to restyle the store, point it at the token block first and
ask it not to hardcode colours that belong in `store.config.ts`.

## Storefront building blocks

| Class / component | Use |
|---|---|
| `.button` + `primary` / `ghost` / `light` / `sm` / `lg` / `icon` | Every button and button-like link |
| `.icon-button` (+ `.count`) | Round header/utility icons |
| `.chip`, `.chip.link`, `.chip.removable` | Tags, note links, active filters |
| `.badge`, `.badge.deal` | Image overlays (discount, sold out) |
| `.panel`, `.icon-tile` | Grey content panels, icon squares |
| `.switch`, `.checkbox`, `.input-affix`, `.search-form` | Form controls |
| `Breadcrumbs`, `SectionHead` (`storefront/ui.tsx`) | Page trail, section title + "View all" |
| `Stars` (`storefront/ui.tsx`) + `.stars` | Read-only rating; fractional fill, colour from `--sf-star`, always paired with the number in text |
| `.form-field`, `.field-hint`, `.star-input` | Labelled inputs/textareas in storefront dialogs (review form) |
| `.store-dialog` + `.store-dialog-head` | Centered storefront dialog (shadcn `DialogContent` with this class) |
| `.suggest-panel` | Search autosuggest dropdown; options are `[role=option]` links, `[data-active]` is the keyboard highlight |
| `.coupon-form`, `.coupon-applied` (`commerce.css`) | Coupon entry / applied state in bag and checkout |
| `CountBadge` (`storefront/count-badge.tsx`) | Header count bubble; pops when the count goes up from a shopper action, not on hydration |
| `SuccessMark` (`storefront/ui.tsx`) | Self-drawing tick for rare "it worked" moments (order placed, review sent) |
| `ProductCard` | Every product tile (home carousels, listings, related, wishlist, recently viewed). A grey panel holding the photo and a white info plate; the name link stretches over the card, the heart and `QuickAdd` sit above it. Stock is only flagged (`.stock-flag`) when it's low or gone |
| `QuickAdd` (`storefront/quick-add.tsx`) | Card shortcut that adds the shown size; a round button that widens to "Add 50 ml" on hover/focus |
| Header nav (`storefront/nav.tsx`) | `DesktopNavigation` (grey rail, gliding highlight), `BrandMenu`, `MobileMenu`; the Shop panel is server-rendered in `shell.tsx`. Mega panels are `.nav-panel` > `.nav-card` > `.nav-row` (icon tile + label + hint) |

## Phone app shell

On phones (≤760 px) the storefront behaves like a native app. It reuses the
tokens and building blocks above; the phone-only rules live in
`src/app/app-shell.css` (its own tokens at the top: bar heights, glass,
sheet radius, how far the page recedes). Tablets and desktops never see it.
Keep the breakpoint in step with `PHONE_QUERY` in
`components/storefront/device.ts`.

| Piece | Where | Notes |
|---|---|---|
| `TabBar` | `storefront/app-shell.tsx` | Floating pill. Shop opens the Browse sheet (`menuStore`), Bag opens the bag sheet, Saved only with `features.wishlist`. Hidden on product pages, checkout and order confirmation, which dock their own actions (`hidesTabBar`) |
| `AppBarBack`, `AppBarTitle` | `storefront/app-shell.tsx`, used in `shell.tsx` | The store logo sits centred on every screen. Back goes through history when it holds one of our pages, otherwise to a parent route; on home the slot offers WhatsApp. Once the page's first `#main h1` scrolls under the bar, its text appears as a small line under the logo, so every page gets it for free |
| `NavProgress` | `storefront/app-shell.tsx`, in the header | Load bar on the nav bar's bottom edge: starts when an internal link is tapped, completes when the page lands |
| `SheetGrabber` | `storefront/sheet-drag.tsx` | Put it first in any bottom `SheetContent` with an `onDismiss`. Makes the sheet draggable (momentum-projected dismiss, rubber band at the top) and drives the page recede. Pass `side={phone ? "bottom" : …}` using `usePhone()` |
| `AddedToast` | `storefront/app-shell.tsx` | Phones don't open the bag on add; `cart.lastAdded` triggers this instead |
| `.phone-shortcuts`, `.quick-filters`, `.gallery-dots`, `.carousel-dots`, `.checkout-dock` | homepage, listing, product page, carousel, checkout | Rendered for every screen size, displayed only on phones |
| Page transitions | `src/app/(storefront)/template.tsx` | Tag a drill-down `Link` with `transitionTypes={["nav-forward"]}`; untagged navigations swap instantly. The tapped card's photo morphs into `.gallery-main` (named on tap in `motion-policy.tsx`) |
| `haptic()` | `storefront/device.ts` | A few milliseconds of vibration for commits (add to bag, back, sheet dismiss). Use sparingly |
| Install | `src/app/manifest.ts`, `apple-icon.tsx`, `pwa-icon/route.tsx` | Icon is the store's initials on `theme.primary`; swap in your own PNGs for a logo |

Touchscreens don't get hover styles: hover-only rules in `storefront.css` sit
inside `@media (hover: hover)` so a tapped button doesn't stay highlighted.
Keep new hover rules there too.

Checks on phones: 360 px with no horizontal overflow, the page title appears
in the bar when you scroll, sheets drag and snap back, and nothing sits under
the tab bar or the home indicator (`env(safe-area-inset-*)`).

## Admin building blocks

`src/app/admin/admin.css` (everything under `.admin-root`) plus:

- `components/admin/ui.tsx`: `PageHeader` ("Section / Page" title + actions),
  `Panel`, `LinkTabs`, `StatusBadge`, `Tag`, `Avatar`, `EmptyState`, `Pagination`.
- `components/admin/fields.tsx`: `ImageField` (drop zone, WebP upload),
  `MarkdownField` (write/preview), `SwitchField`, `ChipChoice`, `ChipMulti`,
  `ConfirmButton` (styled delete confirmation), `useUnsavedGuard`.
- `components/admin/combobox.tsx`: type-to-filter picker (brands, notes).
- Coupons & reviews (`=== COUPONS & REVIEWS` in `admin.css`): `.admin-uses` +
  `.admin-meter` (used / max bar), `.admin-stars`, `.admin-review` rows with a
  `.admin-bulkbar` for bulk approve / reject / delete.
- Action feedback uses `sonner` toasts; the shell mounts the `<Toaster />`.

Admin is deliberately monochrome and doesn't take the store's theme colour, so
it stays readable whatever brand colour a retailer picks.

## Checks before shipping UI

- 360 px and desktop, no horizontal overflow.
- Keyboard focus visible. `html[data-input="keyboard"]` removes motion for
  keyboard users; `prefers-reduced-motion` is respected.
- State is never colour-only: badges and stock dots carry text.
