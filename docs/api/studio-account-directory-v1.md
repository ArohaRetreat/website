# Studio sign-in accounts

Open **Guests → Sign-in accounts** in Host Studio. Use an exact email or Firebase user UID to find an account. **Export all (CSV)** includes the account directory, independent of the current page or search.

## Contract

These same-origin Studio routes use a current verified Google Firebase ID token. An active Aroha `admin` or `superadmin` with booking-manager access can list and export accounts. The API verifies the token and reads the membership on every call. Pre-production uses the tester email allowlist against the shared Firebase Authentication directory. The Studio endpoints are interactive and unavailable to integration tokens.

| Request | JSON body | Successful response |
| --- | --- | --- |
| `POST /api/v1/studio/accounts` | Optional integer `limit` (1–50, default 25) and optional opaque `cursor`. An exact `query` accepts an email or UID and omits the cursor. | `{ items, nextCursor }` with `nextCursor: null` at the end or for a lookup. Production uses Firebase UID order. |
| `POST /api/v1/studio/accounts/export` | `{}` | Attachment `aroha-sign-in-accounts.csv` with `text/csv` and UTF-8 encoding. |

Rows contain `uid`, `name`, `email`, `providers`, `createdAt`, `lastSignInAt`, and `disabled`. Dates are ISO 8601 UTC strings or null. The table displays IST. Both responses set `Cache-Control: no-store`. Account data is limited to these fields. CSV cells with formula prefixes are escaped for spreadsheets.

Errors use the existing `{ error: { code, requestId } }` response. Expired cursors return 400, missing sessions 401, insufficient access 403, and invalid input 422. Each staff member can make 30 list or lookup calls and two export calls per minute. An export is atomic from the caller’s perspective. It returns an error if the directory exceeds 25,000 rows or 8 MiB, or if reading the directory exceeds its time budget.

A completed export records the actor UID, request ID, date and number of rows in the environment’s private audit collection. Logs and metrics use the route and outcome. Auth rows, lookup terms and the CSV stay out of telemetry.

## Cost and verification

The homepage form uses static Hosting assets. Auth and booking requests begin in the existing booking portal. For 20 table or search actions and two exports of 10,000 accounts, expect 22 Functions calls and up to 42 Auth query batches or lookups, plus one token verification and membership read per call, 22 rate-limit reads and writes, and two audit writes. The CSV is generated on demand and adds no Cloud Storage objects or scheduled jobs. Auth checks and lookup traffic vary with request volume.

The Auth emulator tests cover the active-admin gate, revocation, pre-production tester isolation, table pagination, exact lookup and CSV projection. The Hosting gate requires API 0.19.x for website 0.34.x. Roll back the pre-production Hosting artifact first if needed. Website 0.33.x works with the additive API 0.19.x.
