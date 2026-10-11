# ReviewPulse Dine-in Ordering — Operations Guide

## What was added (feedback untouched)

- Customer portal `/order/[slug]` (Order Food / Give Feedback), menu, checkout,
  confirmation/tracking. Existing `/r/[slug]` feedback flow and QR codes unchanged.
- Tables with revocable QR tokens; general (counter) ordering switch.
- Separate `orderMenuItems` / `orderMenuCategories` catalog (feedback `menuItems` untouched).
- Server-priced orders (paise), idempotent creation, unguessable tracking tokens.
- Lifecycle RECEIVED→ACCEPTED→PREPARING→READY→SERVED (+CANCELLED with reason).
- Counter-payment ledger (collect/partial/refund, no auto-refund on cancel).
- Dashboard tabs: Orders, Kitchen, Reports, Tables, Order Menu (existing 7 tabs kept).
- Tests: `npm test` (node:test, no new dependencies).

## Setup (per client deployment)

1. No new environment variables. Existing Firebase + session secrets apply.
2. Deploy Firestore rules: `firebase deploy --only firestore:rules`
   (`firebase/firestore.rules` now covers diningTables, tableQrTokens,
   orderMenuCategories/Items, orders, orderEvents, paymentEntries,
   serviceRequests, counters, restaurant/ordering).
3. Deploy indexes: `firebase deploy --only firestore:indexes`
   (or create via the console link if a query reports a missing index).
4. `npm run client:validate` must stay green; `npm test`, `npx tsc --noEmit`.

## Running the restaurant

1. Dashboard → Order Menu: add categories, items (price in ₹), mark availability.
   Tax % and service charge under “Tax & Ordering Switches”.
2. Dashboard → Tables: Add Table (e.g. T1) → Generate QR → download PNG/SVG or
   Print for table tents. Portal slug = first active campaign slug
   (e.g. `/order/<campaign-slug>?token=…`).
3. Rotate QR (old code stops working, table + history kept) or Revoke when needed.
4. Orders tab: accept → preparing → ready → served; record cash/UPI collection;
   refunds only when money actually returned. Cancel requires a reason.
5. Kitchen tab: simplified display, sound toggle, staff-call inbox.
6. Reports tab + CSV export in Orders tab.

## Security notes

- Table identity comes only from server-validated opaque tokens (SHA-256 lookup,
  constant-time compare). `?table=` style parameters are never trusted.
- Order tracking needs the unguessable per-order access token; phones are masked.
- Prices/totals/status/payments are server-computed; client totals are quotes only.
- Idempotency keys prevent duplicate orders on retry (same key + same phone
  returns the original order).
- Over-collection and refund-beyond-paid are rejected transactionally.

## Known limitations (v1)

- No online payments, OTP, delivery, loyalty, stock deduction (by design).
- No separate staff roles: every authenticated dashboard user is staff. Kitchen
  screen hides phone numbers; payment recording is audit-logged per staff uid.
- Order list API caps at 1000 (reports default 2000); paginate for very large rooms.
- Cart lives in the ordering device’s localStorage; tracking token is also cached
  there (plus URL) for refresh recovery.

## Rollback

- Ordering is additive: to disable, hide the dashboard tabs and stop printing
  table QRs. Feedback QRs and data are independent.
- To roll back code: revert to the pre-ordering commit; Firestore keeps new
  collections harmlessly (rules file must be redeployed from the old revision).
- Never delete `orders` / `paymentEntries` docs; deactivate tables instead.
