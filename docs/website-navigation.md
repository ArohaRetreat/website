# Shared public navigation — 0.10.0

The retreat (`/`) and Living Map (`/map/`) use one full-screen forest menu and one photographic footer. The protected studio and separately owned Natura app retain their own application navigation.

## Adding pages

Add an implemented public route to `PUBLIC_PAGES` in `website/public-pages.mjs`; the desktop quick links and full menu consume this registry. Set `path` when rendering a future route so `aria-current` identifies it. Do not add dead placeholders. Home-section shortcuts are derived from the visible CMS section list. Menu invitations use Natura Lora/Allura; controls use Source and Kannada remains in its own font.

`renderPublicHeader` and `renderPublicMenu` emit markup; `createPublicMenu` owns native dialog opening, Escape/close, focus return, animation cancellation and disposal. Pass the page's current motion state and lifecycle callbacks. Defer CMS replacement until modal close, then resolve any subsequent action against the current DOM. The enquiry action closes the menu before opening the shared details dialog. Public controllers pause media while any modal is open.

## Nature and motion

The existing decorative palm derivative is loaded only on first menu opening. An 800 ms drawer-curve leaf aperture connects the header trigger to the forest scene, with 520 ms content entrances staggered by 40 ms. The final aperture fits the viewport rather than overshooting it and revealing everything in the first few frames. `menu-motion.mjs` reverses the same WAAPI effects at twice their entrance rate for closing; interrupted entrances keep their current frame. Modal focus/scroll locking remains until the finite effects finish, then the current-DOM enquiry or fragment action can run. Escape and keyboard operation close immediately; source disposal and preference changes cancel stale actions. A small falling drop creates expanding water rings; frond sway and water cycles are bounded and never move reading controls. Reading/Simple View, theme motion disabled and reduced-motion preferences retain a static menu. Fine-pointer hover adds a quiet ring around the route arrow; touch does not depend on hover. All motion is native CSS/WAAPI, without another runtime dependency.

## Shared footer and dialogs

`footer.mjs` renders the original home photograph, English and Kannada welcome, enquiry action, map link, host link, copyright and privacy action. `footer.css` is loaded on both routes without importing the whole homepage stylesheet into the map. Map tools disappear when the footer enters the viewport. `guest-dialogs.mjs` shares enquiry/privacy bodies while each route controls modal lifecycle. Names, phone numbers and message text remain excluded from telemetry; WhatsApp preparation does not send a message or confirm a booking.

## Verification and release

`tests/public-chrome.test.mjs` checks shared route/footer contracts, unique dialog/action IDs, CMS visibility and escaping. Existing domain tests cover enquiry validation. Browser review covers route navigation, native Escape/focus, enquiry handoff, privacy, footer overlap and 320/390 px layouts. Responsive desktop iframes are not physical-device acceptance. Hosting-only deployment uses the existing composition guard and pinned Natura export; no API/data/rules migration is required.

## Page transitions — 0.10.1

Public documents opt into browser-native cross-document view transitions, with a 1000 ms leaf aperture, evenly paced scene curve and quiet outgoing settle. The tiny classic head bootstrap registers `pagereveal` before first paint, following [Chrome guidance](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document). It is bundled inline without another request, dependency or private configuration. Public UI modules are render-blocking in the head so the new snapshot includes the initialized layout; fresh cross-page fragment targets are positioned before capture. Unsupported browsers retain ordinary links. Admin and Natura are not opted in.

The browser owns navigation, history and fragment restoration. There is no artificial navigation delay, loading overlay or fetch router. Menu links keep the forest in the outgoing snapshot. A pointer/key interaction can cancel the reveal immediately. Reduced motion, Reading/Simple View, disabled theme motion, keyboard link activation and draft preview skip it.

A session-scoped marker contains only the exact destination path, timestamp and motion flag; it expires after 15 seconds and is consumed on arrival. It suppresses replaying the initial sprout welcome when moving between public pages. When storage is unavailable, the same-origin public referrer and native pagereveal supply the welcome fallback. No message/contact information, telemetry or network request is involved. Same-page fragments do not trigger page reveals. Menu fragment shortcuts fold the menu away before assigning the native anchor destination; ordinary in-page links retain their existing scroll behavior. Fresh external/direct arrivals retain the welcome.

## Sunset atmosphere — 0.11.0

After sunset now selects both the real evening hero image and forest-dark public surfaces. `atmosphere.mjs` defaults to Aroha’s fixed IST schedule: daylight from06:00 until18:00, evening overnight. Guest day/evening choices are stored only until the next scheduled boundary; older indefinite choices no longer override the clock. The bootstrap schedules boundary updates and refreshes after background/history restoration, dispatching the existing bounded same-document event. Storage denial preserves the current-page manual choice in memory. The classic head bootstrap restores the html attribute before paint, including during native page transitions. The shared menu exposes the same reversible control on `/map/` and `/`; it does not change CMS data or the protected studio/design app.

`sunset.css` uses separate semantic dark palette tokens rather than overwriting ambiguous brand colours. Pricing cards, album frames, map stories, navigation controls and enquiry/privacy fields retain readable contrast, borders and leaf watermarks. Original photos are not filtered. `createHeroAtmosphere` restores the selected evening photograph, ignores stale decode results, unsubscribes on replacement, and preserves sunset colours with a status message if only the photograph fails. Daylight removes the scoped overrides. Reduced motion and Simple/Reading View retain their existing motion rules.

## Public motion refinement — 0.12.1

Issue #25 extends the existing motion tokens in page-transitions.css rather than adding an animation library or scroll controller. Full-screen scene changes receive more time than frequent controls: menu 800 ms, content 520 ms with a short stagger, route 1000 ms, gallery 420 ms. The route aperture ends at 75% radii centred in the viewport so coverage reaches the far corners near the end. The old 150% radii masked much of the nominal duration.

Details dialogs use native display/overlay discrete transitions with @starting-style, following [Chrome top-layer guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/animate-to-from-top-layer). Opacity/transform move together with a fading backdrop; unsupported browsers retain native dialogs. Reading/Simple and reduced-motion modes bypass these transitions. No network wait, navigation timer, CSS scroll hijack or extra UI dependency was added. Motion timings are design values, not evidence of physical-device frame rates.

## Public branding — 0.16.3

Both routes use the fixed forest masthead and a prominent white Aroha logo in the shared footer. Insets keep phone tour controls and fragment destinations clear. browser-branding.mjs follows the browser’s colour preference for light/white favicon derivatives, independent of the IST farm atmosphere. theme-color remains#163e2d in both modes/routes; this requests browser tint rather than controlling the native Android UI. The map ending joins the footer without collapsed external margins.

## Booking menu placement — 0.17.1

Book a stay remains in the full Menu; its registry quickLink:false omits it from desktop header links. Signed-in guest account popovers contain native Book a stay (/book/) and My bookings (/book/#visits) links, followed by Sign out. Signed-out account controls retain Google sign-in. Shared link styles keep touch targets and visible focus.
