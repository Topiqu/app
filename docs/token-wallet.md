# Credit wallet

`tokenLimit` is removed. `TokenWallet.balance` is unspent credit, `reserved` is held by running work, and available credit is their difference. `ClientSite.tokenRemaining` remains a read-only compatibility projection; its database trigger rejects writes that bypass the wallet. Plan changes never refill or reset credit.

## Accounting

All wallet mutations lock the tenant row first. Credit grants track origin, remaining units and optional expiry. Purchases, refunds and migrated balances do not expire. Trial grants expire after the trial period. Reservations use the earliest-expiring grants first. Unused allocations are returned on settlement, and expired returned promotional credit is removed immediately.

Provider work runs outside database transactions. `withTokenReservation` reserves before invoking it; `consumeClientTokens` records usage for settlement after successful work. Exceptions release the reservation. Streaming generation explicitly settles before emitting its final billing event; Stop records known partial usage. Provider usage above the reservation is recorded as `actual` but charged only up to `reserved`, at the platform's expense. No client debt is created.

Current maximum reservations in credit units: article generation 10,000; translation and SEO autopilot 5,000; community insights 1,500; prompt enhancement 1,000; sentiment 500. These are per-operation spending caps, not monthly allowances. Billing retains the existing provider-token conversion (`TOKEN_RATIO`) and records ratio, raw usage where available, and pricing version `2026-09-wallet-v1`. Changing conversion rules requires a new price version.

An `Idempotency-Key` header deduplicates manual AI submissions (duplicate keys return 409 and never rerun the provider). A new user action needs a new key. Checkout fulfillment accepts only paid sessions, verifies Stripe signatures, and deduplicates both completed and asynchronous-success events by checkout session ID. Failed asynchronous payments grant nothing.

The maintenance task runs every five minutes and releases reservations older than 30 minutes. Keep provider workflows shorter than that lease; a recovered reservation cannot subsequently be charged. Recovery prioritizes protecting customer credit over recovering platform costs after a process crash.

## Audit and administration

`TokenLedgerEntry` is append-only, enforced by a database trigger. Admin adjustments require superadmin access, positive integer units, a reason and an idempotency key. Credit, bonus, debit and refund are separate operations. Bonus credit expires after 30 days; regular adjustments do not. Refunds reference a completed operation and cannot exceed its original charge, including earlier refunds. Refund credit is nonexpiring; refunds here are credit corrections, not Stripe cash refunds.

The wallet API is tenant-scoped, uses cursor pagination and does not expose raw provider metadata. Usage is calendar-month UTC usage, excluding top-ups and manual debits. Publication activity is a separate UI section.

## Deployment

1. Stop all old application instances and scheduled workers. This is not a mixed-version rolling migration.
2. Back up the database. Deploy the three `20260905` wallet migrations and generate Prisma/ZenStack clients.
3. Opening grants preserve every nonnegative `tokenRemaining` balance, with unknown historical origin explicitly marked `MIGRATION` and no expiry. Earlier top-ups must not be reconstructed from assumptions.
4. Deploy the new application, then resume workers. Verify wallet balance equals ledger sum and available credit equals the compatibility projection.

Rollback needs the database backup plus the matching application version. Do not drop wallet tables or try to reconstruct old capacity semantics from new ledger data.

## Verification

`TEST_DATABASE_URL` must point at a separate database whose name contains `test`. Run migrations there before `bun run test`; the PostgreSQL wallet suite is skipped without this variable. Run `bun run test:e2e token-wallet.spec.ts --project=desktop-light-en --project=mobile-light-en` for the pagination/scroll regression. Tests never use live AI or real payments.
