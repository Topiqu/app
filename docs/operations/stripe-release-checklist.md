# Stripe release checks for the account operator

Use a Stripe sandbox and a separate Topiqu test/staging database. Do not paste keys
into issues, chat, screenshots or commits. No live subscription, Price or webhook
configuration was changed as part of local readiness verification.

Subsequent authorized catalog/configuration fixes are recorded in
[the staged rollout](stripe-catalog-rollout.md). They created no payments or
subscriptions and did not deploy the application. Use that record for the current
catalog and webhook migration state.

The subsequent [sandbox verification](stripe-sandbox-verification.md) records the
actual provider scenarios checked, the invoice defects fixed and the remaining
account-specific verification limits. It does not activate production configuration.

## If test credentials are unavailable

Implementation can proceed with the existing mocked SDK, signed webhook fixtures
and isolated database tests. Keep the real provider lifecycle checks explicitly
unverified until sandbox/test credentials are available; passing mocks does not
prove the Stripe configuration.

A separately authorized read-only inspection may use a restricted live key scoped
to the required catalog/configuration reads. Supply it through a local secret file
or environment, never chat or version control. Do not use a full live secret key
for automated tests or create payments, subscriptions or invoice changes to simulate
success/failure. Live keys access real resources and cannot access sandbox objects;
Stripe directs payment and failure testing to test keys and test payment methods.
See [API keys](https://docs.stripe.com/keys) and [Testing](https://docs.stripe.com/testing).

## Credentials and read-only live checks

The operator can supply the following server-side configuration through the local
environment, not chat or committed files:

- `STRIPE_SK`: preferably a restricted key permitting only the read operations
  needed for this inspection. A live key is not a sandbox key.
- `STRIPE_PK`: the corresponding publishable key from the same Stripe mode.
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_PREMIUM`,
  `STRIPE_PRICE_PREMIUM_ANNUAL` and `STRIPE_PRICE_TRANSLATION_LANGUAGE`: matching
  catalog Prices for that mode. Placeholder/example IDs are not evidence that the
  deployed IDs are correct.
- `STRIPE_PRODUCT_PRO` and `STRIPE_PRODUCT_PREMIUM`: the expected plan Products;
  the app rejects a matching amount attached to an unrelated Product.
- Managed CUSTOM also requires `STRIPE_PRICE_CUSTOM`, `STRIPE_PRICE_CUSTOM_ANNUAL`,
  `STRIPE_PRICE_CUSTOM_MEMBER`, `STRIPE_PRICE_CUSTOM_MEMBER_ANNUAL`,
  `STRIPE_PRODUCT_CUSTOM` and `STRIPE_PRODUCT_CUSTOM_MEMBER`. The base and member
  lines must have matching billing intervals; legacy individual contracts are not migrated.
- `STRIPE_WEBHOOK_SECRET`: the signing secret for the exact application webhook
  endpoint. It is separate from the API key and must be supplied independently.

With appropriate read permissions, inspect configured Prices for active status,
amount, currency, recurrence and mode; inspect the webhook endpoint for its URL,
enabled events, enabled status and API version; inspect the Customer Portal
configuration for the intended product/price changes and cancellation options.
Expand `features.subscription_update.products` when retrieving the portal
configuration; Stripe omits the allowed Products/Prices from an unexpanded read.
Return only safe configuration findings, never API keys, signing secrets or
customer/payment records. Do not create or change any Stripe object for this check.

A catalog/configuration read cannot prove payment success, failure handling, webhook
delivery, renewal or proration. Verify signature/handler logic locally with synthetic
fixtures; keep actual Stripe lifecycle scenarios explicitly unverified without a
test environment. Do not compensate by exercising real customers or charges.

## Configuration

1. Confirm test-mode `STRIPE_PK`, `STRIPE_SK` and `STRIPE_WEBHOOK_SECRET` belong to
   the same sandbox and endpoint. Keep live-mode credentials in production only.
2. Verify PRO/PREMIUM monthly and annual Price IDs, currencies and recurring periods,
   plus the translation-language add-on Price. The repository expects USD 49 / 99
   monthly and a 20% annual discount; the actual Stripe configuration must match.
3. Confirm the webhook destination is the intended deployment's `/api/stripe/webhook`
   and the configured API contract remains `2025-08-27.basil`. Do not upgrade the
   endpoint version merely because the Dashboard offers a newer version.
4. Enable these events used by the current route:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.updated`, `customer.subscription.paused`,
   `customer.subscription.resumed`, `customer.subscription.deleted`, `invoice.paid`
   and `invoice.payment_succeeded`.
5. Confirm Customer Portal configuration and allowed return destinations. Check both
   the central app and a staging custom hostname with the correct locale.

## Run real sandbox flows

| Scenario                          | Expected Topiqu result                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| PRO/PREMIUM checkout              | Correct tenant, plan, price, interval and first-payment state; allowance granted once               |
| Renewal                           | One new monthly allowance; repeated invoice delivery never duplicates it                            |
| Annual subscription               | Annual billing and monthly article grants follow the established policy                             |
| Trial without a card              | Trial status is visible; new custom-domain connection is rejected                                   |
| Trial with a valid saved card     | Eligible custom setup proceeds; ownership proof remains required                                    |
| Trial reaches its stored deadline | Card-less trial becomes BASIC through the expiry sweep; Stripe-backed trial follows Stripe's state  |
| Failed renewal                    | `past_due` follows configured dunning; terminal `unpaid` or cancellation revokes paid entitlements  |
| Subscription paused               | BASIC, excess team access paused, custom domain retired and cleanup queued                          |
| Resume and pay                    | Current provider state restores the plan; an old event cannot restore an obsolete status            |
| End-of-period cancellation        | Access remains until the paid period ends, then transitions to BASIC                                |
| Immediate cancellation            | BASIC and free hostname commit together; provider cleanup completes or remains visibly retryable    |
| Duplicate/out-of-order events     | No duplicate allowances; retrieve current subscription status before applying the event             |
| Article pack                      | Correct pack once; purchased balance survives trial/subscription expiry                             |
| Add-on language                   | Correct recurring Price and quantity; cancellation removes the paid entitlement according to policy |

Use sandbox subscription simulations/test clocks to advance renewal/trial time, and
inspect webhook deliveries and application state together. A synthetic event with a
nonexistent subscription cannot prove an integration that retrieves current provider
state. Test signature rejection separately; accepting an invalid signature is a
release blocker.

A Stripe test clock does not advance Topiqu's own clock. For a card-less Topiqu
trial, use an isolated fixture with a past `trialEndsAt` and run/wait for the expiry
task; never change production trial timestamps to perform this check.

For custom-domain cleanup, use an isolated provider zone/application or have the
domain operator perform the check. Never point staging cleanup at production resource
IDs. Deliberately simulate provider failure and confirm the old hostname no longer
serves the blog while cleanup remains retryable.

## Managed CUSTOM seat billing

The approved monthly amounts are USD 159 including the owner and USD 20 per
additional member, with a minimum package of three members, as recorded in
`ai-economics-proposal.md`. The minimum costs USD 199 before tax. The 2026-11-04
implementation buys seat capacity explicitly; an invitation cannot authorize a
charge. Minimum capacity remains three even with fewer occupants. Old individually
configured CUSTOM contracts remain unchanged. Deploying and activating the live
configuration still requires the operator's release process.

Annual CUSTOM receives the approved 20% discount on both the base and seat charge:
the three-seat minimum is USD 1,910.40 per year and each additional seat is USD 192
per year. Verify exact cent amounts, annual interval and prorations against the
matching annual Prices. Preserve the blog's monthly allowance periods.

The opt-in sandbox test verifies quoted versus paid proration, replay, unused-seat
reduction and a declined payment retaining old capacity. Reductions bill the lower
amount next renewal, without a refund; members and pending invitations must fit.
Repeat an authorized deployment smoke without manufacturing live payments.

## Evidence to retain

Record the tested commit/image, scenario, redacted event/customer/subscription IDs,
delivery result, expected/actual tenant state and allowance changes. Store no payment
details or secrets. Confirm the equivalent live-mode Price IDs, signing secret and
event subscriptions before an approved deployment; sandbox success does not configure
the production account.

Official references: [Billing testing](https://docs.stripe.com/billing/testing),
[Prorations](https://docs.stripe.com/billing/subscriptions/prorations).
