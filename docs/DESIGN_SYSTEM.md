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
| `ProductCard` | Every product tile (home carousels, listings, related, wishlist, recently viewed) |

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
