# Storefront polish — 17 September 2026

Implemented before Phase 3 under the user's approval. Uses better-ui,
find-animation-opportunities, improve-animations, and emil-design-eng. Retains
the Scandinavian direction and existing fictional artwork. No new dependencies
or edits to `src/components/ui/`.

## Verified findings and changes

| Severity | Principle | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility / frequency | `src/components/storefront/carousel.tsx:21` | Embla movement unaffected by CSS reduced-motion settings; keyboard scrolling animated | Live preference and input-mode handling; duration 0 for reduced motion/keyboard, arrow navigation jumps immediately | Functional keyboard input must not wait for motion |
| MEDIUM | Interruptibility | `src/app/globals.css:1787` | Lightbox inherited keyframe entrances; sheets used generic easing | Lightbox opacity/scale transitions, 200ms enter / 150ms exit; sheets 240ms translate with drawer curve / 160ms exit | Reversible state changes retarget without restarting a sequence |
| MEDIUM | Accessibility / state | `src/components/storefront/shell-controls.tsx:145` | Announcement could change a focused link's destination | Rotation pauses on focus, hover, hidden document, or reduced-motion preference | Reading and keyboard interaction remain stable |
| MEDIUM | Sizing / typography | `src/app/globals.css:1714` | Mobile icons 36px; product details 11px; uneven metadata heights | 44px targets, 12px details, 15px product titles/prices, reserved metadata space; balanced headings and tabular prices | Clearer reading and easier touch interaction |
| LOW | Surface consistency | `src/app/globals.css:1740` | Images lacked a consistent boundary; nested search/thumbnail radii unrelated | Pure-black 10% inset outlines, concentric radii, subtle layered menu/wishlist shadows | Defines structure without heavy borders |
| LOW | Motion cohesion | `src/app/globals.css:1775` | No tactile press cue; abrupt saved-state and gallery changes | Shared curves, 150ms feedback, specific transitioned properties | Brief feedback confirms interaction while preserving reading stability |

## Accepted opportunities and gate decisions

| # | Location | Today (before) | Purpose | Frequency | Implemented motion |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/app/globals.css:1775` | Buttons had no press feedback | Feedback | Tens/day | Pointer press scale 0.96, transform 150ms cubic-bezier(0.23,1,0.32,1); disabled/static controls excluded; keyboard instant; reduced motion removes scale |
| 2 | `src/components/storefront/wishlist-button.tsx:50` | Heart fill changed abruptly | State indication | Occasional | Two persistent icon states, opacity 0→1 / scale 0.25→1 / blur 4px→0; 150ms cubic-bezier(0.2,0,0,1); reduced motion uses only 120ms opacity; aria-pressed remains the static cue |
| 3 | `src/components/storefront/product-details.tsx:40` | Main gallery source swapped instantly | Preventing a jarring change | Tens/day | Persistent image layers with 150ms opacity ease; 120ms reduced-motion fade; keyboard instant; selected thumbnail remains outlined |

Each stays within its speed budget and leaves information immediately usable.
No entrance delay, gesture library, or decorative scrolling effect was added.

## Deliberately rejected

- Product-grid stagger: frequent browsing/filtering, fails frequency and function gates.
- Animated price or quantity numerals: functional information should update immediately.
- Mega-menu entrance choreography: core navigation should remain immediate.
- Scroll reveals and moving product cards: repeated attention cost without explaining a state change.

## Verification

- Lint, typecheck, existing tests, idempotent seed, and production build checked.
- Browser inspection at 360 × 800 and 1440 × 900: catalog, filter sheet, product
  gallery/lightbox, product details and homepage controls.
- Gallery selection retains selected-state outline and fades to the requested image.
- Lightbox uses CSS transitions with no running keyframe animation; Escape closes it.
- Keyboard input sets all storefront transitions to 0ms; Enter advances the hero
  to the next slide with its heading aligned in the viewport.
- Wishlist click updates aria-pressed and the persistent filled heart; test save removed.
- Sheet computed styles match 240ms translate / 200ms opacity and exact shared curves.
- No browser console errors during the checked interactions.
- Reduced-motion CSS and Embla preference subscription inspected in source.
- **Not verified:** physical touch-device gestures, OS reduced-motion switching in
  the browser, DevTools 10% playback / frame-by-frame inspection, and simultaneous
  rapid open/close interruption under load. The available browser control did not
  provide the required DevTools playback/emulation controls.

The interface needs modest state feedback, not entrance choreography. Immediate
keyboard operation is the highest-leverage correction. The approved opportunities
have been implemented directly; no separate execution handoff is needed.

**Approve for inspected coverage.** No confirmed HIGH finding remains. Unverified
motion conditions above are not claimed as approved coverage.

## Micro-interaction follow-up

| Location | Before | After | Why |
| --- | --- | --- | --- |
| `src/app/globals.css` link/navigation rules | Links changed decoration abruptly | Left-origin underline, transform 150ms cubic-bezier(0.23,1,0.32,1); open navigation retains its line | Fast pointer feedback with persistent state |
| `src/app/globals.css` quantity/thumbnail/pagination rules | Several controls lacked press/hover response | Scale 0.96 press over 150ms, fine-pointer hover backgrounds/borders; quantity targets 44px | Consistent click and tap feedback |
| `src/components/storefront/motion-policy.tsx` | Sticky header had no depth cue | IntersectionObserver toggles a 150ms opacity shadow when header reaches the top | Indicates separation during scrolling without scroll-event work |
| `src/app/globals.css` anchor scroll rules | Anchor jumps abrupt | Native smooth pointer scrolling with header clearance; keyboard/reduced-motion instant | Preserves orientation while leaving wheel/touch scrolling native |
| `src/components/storefront/motion-policy.tsx` | Keyboard mode persisted until mouse click | Mouse movement restores pointer feedback | Hover feedback resumes when switching input devices |

No animated prices, result-list entrances, cursor tracking, or scroll interception.
