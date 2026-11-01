# Shared public navigation — 0.10.0

The retreat (`/`) and Living Map (`/map/`) use one full-screen forest menu and one photographic footer. The protected studio and separately owned Natura app retain their own application navigation.

## Adding pages

Add an implemented public route to `PUBLIC_PAGES` in `website/public-pages.mjs`; the desktop quick links and full menu consume this registry. Set `path` when rendering a future route so `aria-current` identifies it. Do not add dead placeholders. Home-section shortcuts are derived from the visible CMS section list. Menu invitations use Natura Lora/Allura; controls use Source and Kannada remains in its own font.

`renderPublicHeader` and `renderPublicMenu` emit markup; `createPublicMenu` owns native dialog opening, Escape/close, focus return, animation cancellation and disposal. Pass the page's current motion state and lifecycle callbacks. Defer CMS replacement until modal close, then resolve any subsequent action against the current DOM. The enquiry action closes the menu before opening the shared details dialog. Public controllers pause media while any modal is open.

## Nature and motion

The existing decorative palm derivative is loaded only on first menu opening. A 280 ms ease-out leaf aperture connects the header trigger to the forest scene. A small falling drop creates expanding water rings; frond sway and water cycles are bounded and never move reading controls. Reading/Simple View, theme motion disabled and reduced-motion preferences retain a static menu. Fine-pointer hover adds a quiet ring around the route arrow; touch does not depend on hover. All motion is native CSS/WAAPI, without another runtime dependency.

## Shared footer and dialogs

`footer.mjs` renders the original home photograph, English and Kannada welcome, enquiry action, map link, host link, copyright and privacy action. `footer.css` is loaded on both routes without importing the whole homepage stylesheet into the map. Map tools disappear when the footer enters the viewport. `guest-dialogs.mjs` shares enquiry/privacy bodies while each route controls modal lifecycle. Names, phone numbers and message text remain excluded from telemetry; WhatsApp preparation does not send a message or confirm a booking.

## Verification and release

`tests/public-chrome.test.mjs` checks shared route/footer contracts, unique dialog/action IDs, CMS visibility and escaping. Existing domain tests cover enquiry validation. Browser review covers route navigation, native Escape/focus, enquiry handoff, privacy, footer overlap and 320/390 px layouts. Responsive desktop iframes are not physical-device acceptance. Hosting-only deployment uses the existing composition guard and pinned Natura export; no API/data/rules migration is required.

## Page transitions — 0.10.1

Public documents opt into browser-native cross-document view transitions, with a 500 ms leaf aperture and quiet outgoing settle. The tiny classic head bootstrap registers `pagereveal` before first paint, following [Chrome guidance](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document). It is bundled inline without another request, dependency or private configuration. Public UI modules are render-blocking in the head so the new snapshot includes the initialized layout; fresh cross-page fragment targets are positioned before capture. Unsupported browsers retain ordinary links. Admin and Natura are not opted in.

The browser owns navigation, history and fragment restoration. There is no artificial navigation delay, loading overlay or fetch router. Menu links keep the forest in the outgoing snapshot. A pointer/key interaction can cancel the reveal immediately. Reduced motion, Reading/Simple View, disabled theme motion, keyboard link activation and draft preview skip it.

A session-scoped marker contains only the exact destination path, timestamp and motion flag; it expires after 15 seconds and is consumed on arrival. It suppresses replaying the initial sprout welcome when moving between public pages. When storage is unavailable, the same-origin public referrer and native pagereveal supply the welcome fallback. No message/contact information, telemetry or network request is involved. Same-page fragments remain native and do not trigger page reveals. Fresh external/direct arrivals retain the welcome.
