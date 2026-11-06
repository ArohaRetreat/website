# Aroha Material 3 interface contract — website 0.30 / API 0.15

Owner request, 7 November 2026. Delivery is preprod only; production promotion requires the owner's review. Issue #111 includes the booking/Studio component overhaul and cancellation-email refinement. The owner confirmed booking and Studio pages only. Public photographic marketing pages and Natura are outside this implementation; their existing content, assets and identity are preserved.

## Experience decisions

The three daily tasks remain Review requests, Add a walk-in and Check-in. Desktop uses a navigation drawer and a bounded results table; phones use bottom navigation and booking cards. Filters are server-backed, visibly removable and reset cursor position. No list downloads a customer directory or adds per-row customer queries.

Aroha forest green is the primary role; pale sage provides tonal containers, white surfaces distinguish forms, and terracotta is reserved for destructive/error emphasis. Google Sans is bundled locally for titles/control labels; Source Sans 3 is bundled locally for body text/entry. Google Sans comes from Google's font distribution under SIL OFL, included alongside the font. Public marketing typography is not changed.

| Before | After | Why |
| --- | --- | --- |
| Browser-default date popup | Material calendar modal plus labelled DD/MM/YYYY entry | Dates remain readable, keyboard-operable and consistent on phone/desktop |
| Native select rendering | Labelled selection button and bounded listbox with selected/disabled states and typeahead | Options stay legible without inheriting platform-specific geometry |
| Visit type hidden in a dropdown | Four visible visit-choice cards | Hosts can compare accommodation/day/exclusive options before choosing |
| Tiny number spinners | Bounded 44px decrement/increment targets with editable count | Makes guest counts usable by touch while preserving direct entry |
| Full-width stretched booking actions | Explicit primary action, secondary tools and separately styled destructive action | The next booking step is distinguishable from supporting operations |
| Edge-to-edge old booking options | Tonal header, padded content, date/price summary and grouped controls | Every route into booking details uses the same hierarchy |
| Browser confirm boxes | Cancellable modal confirmation with an explicit action | Consequences remain visible before the existing mutation handler runs |
| Plain cancellation notice | Branded status card, quietly disappointed Hrudhi and useful next steps | States the cancellation without implying checkout or refund |

Material guidance is applied to component anatomy, tonal roles, 56px fields, pill actions, 44–48px touch targets, 8px spacing increments, state indication and focus. Frequent navigation is immediate; reduced-motion preferences suppress movement. Application HTML remains semantic; this is not an Android component port or a new frontend framework.

Research: [Material 3 date pickers](https://m3.material.io/components/date-pickers/guidelines), [Material 3 menus](https://m3.material.io/components/menus/guidelines), [Google's picker anatomy](https://github.com/material-components/material-components-android/blob/master/docs/components/DatePicker.md), [NNGroup dropdown tradeoffs](https://www.nngroup.com/articles/dropdown-list/), [NNGroup date input guidance](https://www.nngroup.com/articles/date-input/), [WAI date-picker keyboard/focus pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/), [Google Sans OFL source](https://github.com/googlefonts/googlesans).

## Component and screen inventory

Shared `material.css` owns semantic roles, typography, fields, buttons, radios/checkboxes, menus, date and 24-hour time pickers, split payment date/time entry, steppers, dialogs, cards, lists, summaries, errors, loading/disabled/focus and reduced-motion treatment. `frontdesk.css` now owns only the responsive staff workspace rather than a copied preview theme and incremental overrides. `material-controls.mjs` owns shared interactions, with native fields retained as validation/FormData values.

Covered surfaces: Studio sign-in/module navigation/access; front desk/task queues/results/filter dialogs; walk-in Guest/Visit/Review steps; booking decision drawer and legacy booking-options/contact/mail/allocation paths; room calendar/inventory/policies/offers; customer lookup/history/loyalty; payments/reversal/documents/private feedback; guest booking search, dates, party counts, accommodation/review, account/visits/credits and detail sheets. The Website changes editor receives shared typography/controls and navigation treatment while retaining its mounted draft frame. Website changes content/publishing semantics stay intact.

Calendars do not invent inventory availability. The staff picker enforces date bounds; quote/confirm still consult the shared server policy. Guest availability shading continues using the existing bounded calendar endpoint. Dropdowns retain native values, required/disabled state and change handlers. Dialogs remain native modal dialogs with focus restoration; nested calendars/confirmations remain above their parent. Long names and narrow widths wrap; rows paginate rather than append indefinitely.

## Business and email compatibility

No change to capacity, pricing, child ages, event boundaries, scoped access, version checks, customer identity, loyalty, payment verification or feedback privacy. Quote precedes manual confirmation. Booking approval, check-in and payment remain separate steps. Uncertain mutations retain their frozen payload and idempotency key.

New cancellation/decline jobs snapshot `email-v5-status`; `email-v4-status` retains its original renderer. The email uses inline/table markup and CID logo/Hrudhi attachments, with plain text and image alt text. Hrudhi is a generated derivative of the approved character, not a replacement identity. The notice never claims a refund or checkout occurred. Existing confirmation/lifecycle templates are preserved.

New mail defaults to Reply-To `retreataroha@gmail.com`; the preprod runtime release explicitly selects the same address through `--reply-to retreataroha@gmail.com`. Test-inbox mode continues redirecting recipients but no longer replaces Reply-To. Existing queued snapshots and provider retry payloads are unchanged. There is no historical replay.

## Validation and release

Run application/control/booking/privacy/retry tests, emulator HTTP acceptance, foundation checks and both responsive browser reviews. The external integration runner serializes its two files to isolate shared fixtures (#126), retaining all within-file concurrency tests and purity assertions. Use synthetic local accounts only for browser writes; no live test bookings/payments/emails.

Release the reviewed source via PR to preprod with all required checks. Prepare the runtime from clean merged source using `prepare-runtime-release.mjs --environment pre-prod --reply-to retreataroha@gmail.com`; verify that MAIL_REPLY_TO is the sole intended environment change. Selectively deploy API and email dispatch/retry; preserve worker, secrets, owners, billing, other settings and records. Deploy exact-source non-emulator Hosting. Verify provider versions/config, live asset hashes, protected-route denial, production preservation and booking/CMS baselines separately. Save receipts privately. This document is a contract, not a claim that a deployment or owner UX acceptance occurred.

Rollback UI independently; retain all business records. Roll back new-mail rendering only by a compatible renderer that still supports queued v5 jobs. Do not restore an old worker that cannot render them, delete outboxes or resend accepted jobs. Restoring the old Reply-To is a separate explicit config change.

Privacy patch0.30.1 explicitly masks every shared calendar/menu/time/confirmation popup before insertion, including detached top-layer elements. Private credit-adjustment reasons and selection labels remain inside the RUM privacy boundary. No API or business-policy change.
