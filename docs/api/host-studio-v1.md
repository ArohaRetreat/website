# Host Studio v1

Host Studio uses the existing `POST /api/v1/platform` endpoint with a verified Google session and the `operation` and `input` envelope. These operations are interactive. The external integration token and MCP registries remain separate. The dashboard is available to active booking viewers and managers. Guest profiles, guest email and staff document lists require active booking manager access. Guest document lists are bound to the signed-in guest’s verified customer link. Every request rechecks current authorization.

| Operation | Input | Result |
| --- | --- | --- |
| `getStudioDashboard` | Empty object | IST day, active request and arrival counts, checked-in count, checkout count, today’s agenda, on-site balances, recorded payment trend |
| `getStudioGuest` | Customer `id` | Verified customer contact projection, guest number, completed visit count, recorded nights, net verified payments in paise, available credits |
| `listStudioDocuments` | Optional customer `id`, `limit` and `cursor` | Issued invoice, receipt and checkout statement metadata |
| `listStudioGuestPayments` | Customer `id`, optional `limit` and `cursor` | The guest’s verified payments and reversal entries |
| `listMyDocuments` | Optional `limit` and `cursor` | The guest’s issued documents. An invoice appears after a verified payment or full loyalty settlement. |
| `listStudioEmail` | Optional customer `id`, `limit` and `cursor` | Guest email summaries with queue and delivery status |
| `getStudioEmail` | `jobId` | One message’s recipient, subject, staff-written body when available, and delivery timestamps |
| `sendStudioEmail` | Customer `id`, optional `bookingId`, `subject`, `message` | A queued outbox receipt |

Studio can request compact host configuration with \`GET /api/v1/booking/state?admin=1&workspace=1\`. It skips loading the calendar, audit page and booking history until needed. Guest search and booking history use the existing `lookupCustomers` and `listCustomerReservations` operations. Paged lists cap pages at 20 records and bind cursors to the current actor and view. The guest profile calculates net verified payments from payments and reversals, separately from the quoted booking value. Nights are derived from recorded check-in and checkout times on completed overnight stays. Unknown historical nights are reported explicitly. The dashboard bounds agenda, balance and trend reads and reports when a metric exceeds its read budget.

Document downloads use the existing owner-or-manager `downloadDocument` operation. The API renders from the original issued snapshot and template version in memory. New downloads and confirmation attachments require zero Cloud Storage operations. Voided and superseded documents cannot be downloaded. Existing document numbers, snapshots and historical objects are retained. A receipt records the amount and balance at its payment; the current balance is shown separately.

Email is an explicit, idempotent staff action. Recipients come from the selected guest’s stored email and any associated booking must belong to that customer. Plain text is escaped before HTML rendering. Pre-prod respects the configured test inbox or restricts sends in booking mode to the tester allowlist. The existing worker and signed Resend webhook supply accepted, delayed, delivered, bounced and failed states. Delivery means the recipient mail server accepted the message. Replies use the configured Reply-To inbox.

Invalid input returns a bounded error code. Missing permissions return `403`, an unrelated booking or unknown message returns `404`, duplicate idempotency keys with different payloads return `409`, expired cursors return `410`, and send throttles return `429`. Operations use existing platform audit and request telemetry. Names, addresses, email bodies and document details stay out of telemetry.

## Production promotion

Website 0.32.1 requires API 0.17.0. Verify the production counterparts of the Studio payment, document, invoice and notification indexes before deploying the API and existing mail workers. Publish Hosting from the checked production branch. Preserve the mail configuration, guest numbering and ID retention rules. Exercise booking creation, payments, PDFs and email delivery with synthetic data in Firebase emulators. Use live version, asset, access and configuration reads for production verification.
