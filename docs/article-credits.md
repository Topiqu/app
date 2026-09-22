# Article allowances

Customers buy and spend articles, never model tokens. One successful manual or scheduled generation costs exactly one article regardless of research depth, model, output length, or selected media. Translation, prompt enhancement, sentiment, and other supporting AI features do not spend articles.

The current policy is versioned as `2026-09-articles-v1`:

- Trial: 5 articles, valid until the trial ends.
- PRO: 20 articles per month.
- PREMIUM: 30 articles per month.
- Add-ons: 5 / 12 / 25 articles; purchased articles do not expire.

Plan articles expire at the end of their monthly allowance period and are consumed before non-expiring purchases. Annual subscriptions are billed annually but receive a new monthly grant from the `grant-annual-article-credits` task. The Stripe invoice webhook creates the first grant and monthly invoices create subsequent grants. A mid-period upgrade grants only the difference to the new plan allowance; a downgrade does not claw back articles already granted.

## Reservations and concurrency

Before any provider call, `reserveArticleCredit` atomically takes one article from the earliest-expiring grant and increments the wallet's reserved count. This is the concurrency guard: two simultaneous generations require two available articles. The amount is fixed because the customer price is fixed at one article, not because provider costs are assumed to be fixed.

A successful generation settles the reservation as one debit. Errors and user cancellation return it. Reservations have a 30-minute lease and are released lazily on the next wallet read or reservation, protecting customers after a process crash. Idempotency keys prevent duplicate grants and duplicate operations.

`ArticleCreditWallet.balance - reserved` is the authoritative customer-visible balance. Grants preserve source, amount, remaining amount, policy version, period, and expiry. `ArticleCreditLedgerEntry` provides the customer/admin history. Database constraints prevent negative balances, over-reservation, and invalid grant amounts.

## Internal token metering

Provider tokens remain an internal cost and observability metric. `TokenWallet`, `TOKEN_RATIO`, and per-operation token reservations are not an entitlement and are never exposed as customer balance. If internal capacity is lower than a provider risk reservation, the cost meter creates internal capacity rather than rejecting customer-authorized work. A metering failure is reported for operations but does not convert a completed article into a failed customer run.

The current risk reservations (24k–43.5k for manual generation and 40.5k for scheduled generation) remain useful for cost attribution and anomaly detection. They do not determine whether the customer may start; the article reservation does.

## Stripe and administration

Checkout resolves pack price and article quantity from the server-side catalog. Webhook signatures are verified, only paid sessions are fulfilled, and checkout/invoice IDs are idempotency keys. Subscription access still follows Stripe subscription lifecycle events.

Superadmins can add, bonus, debit, or return whole articles with a required reason and idempotency key. Bonus articles expire after 30 days. Regular admin additions and returns do not expire.

## Deployment

There are no paying customers to migrate. Deploy the `20260919143000_article_credits` migration, regenerate Prisma/ZenStack clients, and deploy the application and scheduler together. Legacy token tables and `ClientSite.tokenRemaining` stay temporarily for internal cost telemetry only and can be removed in a later schema cleanup after operational dashboards no longer depend on them.
