# Stripe sandbox verification

Verified on 2026-11-03 against the working tree on `dev`, based on `44717997`.
This was a one-off provider integration check, with permanent PostgreSQL regression
tests added for the defects it exposed. It did not deploy the application or change
live customers, subscriptions, payments, environment variables or database records.

## Isolation and artifact

- Credentials came exclusively from the ignored, mode-0600 `.env.stripe-sandbox`.
  The runner rejected non-test key prefixes and verified `livemode: false` through
  Stripe before provisioning test objects. The production `.env` was not loaded.
- Products, Prices, a portal configuration, synthetic customers, subscriptions,
  invoices and test clocks were created only in that sandbox. Test card details
  and Stripe's test PaymentMethod fixtures simulated payments; no real money moved.
- The application used the separate local PostgreSQL database `topiqu_image_test`.
  Its migrations were already applied; container startup checked them again.
  Scheduled jobs and external provider credentials were disabled in the test runtime.
- A single new image was built: `topiqu-stripe-sandbox:20261103`, manifest
  `sha256:814559ddacf9bbdd1de81e2a2abb1a2aaa8c86481fb2d966bd7b5303fc3ea77d`.
  It ran as UID 1000 with Bun 1.4.4 and passed readiness.
- Outgoing Stripe requests used the application's pinned `2025-08-27.basil` contract.
  Stripe CLI 1.55.8 forwarded actual signed sandbox events to the local HTTP handler;
  its account-default event version was `2026-06-24.dahlia`. Additional duplicate,
  delayed and tampered deliveries were replayed locally with test signatures.
- The sandbox catalog contains PRO USD 49/month and USD 470.40/year, PREMIUM
  USD 99/month and USD 950.40/year, and the USD 9/month language add-on. Its IDs
  and listener secret stay in `.env.stripe-sandbox`, separate from live IDs.

## Results

| Scenario                                  | Observed result                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted monthly PRO checkout               | Correct USD 49 price, completed test payment, subscription/customer binding, first-payment marker and one 30-article allowance           |
| Hosted annual PREMIUM checkout            | Correct USD 950.40 price, completed test payment, ANNUAL billing and one 50-article allowance                                            |
| Annual allowance period                   | First allowance ends after one month, rather than granting twelve months at once                                                         |
| Monthly renewal using a test clock        | Active subscription and exactly one new monthly grant                                                                                    |
| Trial starts without a card               | Zero-value trial invoice does not create a paid monthly allowance                                                                        |
| Trial ends without a card                 | Stripe pauses it; the application becomes BASIC                                                                                          |
| Paused trial resumes with a test card     | Paid invoice restores PREMIUM and grants exactly one 50-article allowance                                                                |
| Trial invoice arrives after activation    | Accepted without an additional allowance                                                                                                 |
| Failed renewal                            | Provider becomes `past_due`; application retains grace-period access without granting unpaid articles                                    |
| Failed renewal is paid                    | Current active state reconciles and the renewed allowance is granted once                                                                |
| Duplicate invoice event names             | Repeated `invoice.paid` and `invoice.payment_succeeded` do not duplicate a grant                                                         |
| Mid-period PRO to PREMIUM upgrade         | Only the 20-article difference is added, with provider proration                                                                         |
| Customer Portal                           | Session uses the sandbox configuration; price changes, prorations and period-end downgrade conditions are configured                     |
| Cancel at period end                      | Paid access remains until the simulated deadline, then BASIC and the subscription link is cleared                                        |
| Attempt a second subscription checkout    | HTTP 409 while the original subscription is active                                                                                       |
| Hosted language add-on checkout           | USD 18 for two languages; actual events set the paid quantity without granting plan articles                                             |
| Language quantity change and cancellation | Quantity changes to three, then zero; the primary PRO subscription remains intact                                                        |
| Hosted article-pack checkout              | USD 8.99 grants five purchased articles exactly once                                                                                     |
| Duplicate pack event names                | Neither completion nor asynchronous-success replay duplicates the purchase                                                               |
| Immediate primary cancellation            | BASIC and the free managed hostname commit together; purchased articles remain unexpired                                                 |
| Custom-domain retirement                  | A synthetic local connection becomes DISCONNECTING with durable cleanup requested; no Cloudflare/Dokploy resource was created or removed |
| Tampered webhook body                     | HTTP 400 before any grant                                                                                                                |

## Fixes and automated checks

The sandbox exposed two invoice-ordering defects:

1. A paid zero-value trial invoice could grant the full monthly allowance in addition
   to the welcome trial. Invoice handling now checks the provider's current active
   state and excludes the trial period even if its invoice arrives after activation.
   A fully discounted active paid period still receives its allowance.
2. Both invoice-success events could precede Checkout and be acknowledged without
   granting the first allowance. An active paid invoice can now bind an unlinked
   blog with a compatible customer, reconcile plan/features and grant in one
   transaction. It cannot replace another subscription or a different customer,
   and it never overwrites an existing first-payment timestamp.

`tests/server/stripe/allowanceWebhook.integration.test.ts` exercises the real signed
handler and PostgreSQL wallet for these cases, including reordered events, matching
and conflicting customers, a newer subscription and first-payment preservation.
Its synthetic fixtures do not call Stripe and require the existing isolated
`TEST_DATABASE_URL` setup. Immutable financial fixtures remain in that disposable
test database, matching the wallet integration tests.

The final focused Stripe/hardening run passed **101 tests in 10 files**. Typecheck,
scoped ESLint, the production image build and whitespace checks passed. The full
repository suite and unrelated browser matrix were not repeated for this scoped fix.

## Limits and production handoff

Sandbox verification does not activate production configuration. Follow
[the catalog/webhook rollout](stripe-catalog-rollout.md) using the live environment,
not `.env.stripe-sandbox`, and check the versioned endpoint's real delivery after
deployment. No historical production allowances were changed by these fixes.

Test clocks advance Stripe, not Topiqu's process clock. Renewal assertions checked
new grant creation and period boundaries; they do not prove the running scheduler's
annual monthly catch-up or wall-clock grant expiration. Automatic dunning through
every configured retry to terminal `unpaid`, payment-method variants, tax and refund
scenarios were not exhausted. The existing local lifecycle tests cover terminal
state revocation; the account-specific dunning policy still needs operator review.

The subsequent 2026-11-04 working tree implements managed CUSTOM seat billing and
per-blog auxiliary/provider capacity. Its verification is recorded below. See
[the release checklist](stripe-release-checklist.md) and
[the implemented policy](ai-economics-proposal.md).

The local listener, browser and application/database containers are stopped after
verification. Sandbox catalog/configuration and labelled synthetic objects remain
available for inspection; their IDs and ephemeral Checkout/Portal URLs are not
published in this report.

## Managed CUSTOM and AI allowances, 2026-11-04

An opt-in integration test (`STRIPE_SANDBOX_VERIFY=1`) calls the actual
`/api/stripe/seats` handler with the real Stripe sandbox and isolated PostgreSQL
`topiqu_readiness_test`. It refuses live keys and checks `balance.livemode` before
creating its synthetic customer. Its finally hook cancels that subscription and
deletes that customer; no live customer or payment is accessed.

The run passed these provider assertions:

- PRO to minimum CUSTOM: USD 199 monthly recurring price, with the exact confirmed
  proration equal to the successfully paid test invoice.
- Altering the quoted target is rejected before creating an invoice.
- Replaying a completed confirmation creates no second invoice.
- Increasing capacity to five then reducing unused capacity to three does not
  create an invoice for the reduction.
- Replaying the old five-seat quote after that reduction cannot restore unpaid
  capacity or issue a new invoice.
- A declined test card leaves the update pending, returns the hosted payment link
  and keeps the existing three-seat entitlement. No unpaid capacity is granted.

Separate PostgreSQL tests exercise concurrent reservations, tenant isolation,
unknown/expired work, overruns, explicit pack replay, purchased-article funding
isolation, the USD 1 whole-trial limit, invoice discounts, zero-dollar receipts,
annual monthly normalization, delayed initial invoices after proration, discounted
annual tier changes and stable proration slot boundaries. They call no paid AI
provider and do not establish measured whole-article costs or margins.

The ordinary suite skips the remote integration test intentionally; its explicit
opt-in run passed. Existing historical verification above remains evidence for
the earlier artifact only, not proof that the new working tree was deployed.
The local ignored live configuration was completed with the expected CUSTOM Product
IDs through read-only catalog inspection. No live Stripe object was changed.

Final local application checks passed:

- Vitest: 501 files, 4,049 tests passed; 9 files / 44 tests intentionally skipped
  (including separately opted-in provider tests and unavailable optional services).
- Full ESLint, Prettier, OpenAPI check, ZenStack generation and Nuxt typecheck.
- Production `build:docker` script and all seven existing asset performance budgets.
- Release smoke plus wallet scrolling: 9 browser scenarios passed against the built
  server and isolated migrated PostgreSQL database.
- The prepared runtime entrypoint found all 141 committed migrations, applied none
  twice and started a healthy server. This checks the new artifact's migration
  package locally; a new Linux Docker image was not rebuilt in this phase.
- AI usage and CUSTOM capacity were inspected in the production artifact on desktop
  English and mobile Czech in dark mode, with zero horizontal page overflow.

The pricing/onboarding landing also passed its 28 tests, scoped ESLint, typecheck
and production build. Browser checks confirmed USD 199 monthly / USD 1,910.40
annual CUSTOM totals and the matching annual onboarding link. No signup or live
payment was submitted. Local test application processes and the disposable database
were stopped after verification. Nothing was committed, pushed or deployed by these checks.

## Durable signup recovery, 2026-11-04

The subsequent recovery work adds a system-only PostgreSQL request record and
freezes the original trial deadline. Fourteen local route integration cases cover
lost customer/Checkout responses, another database client, concurrent workers,
original details and renewed proof, key collisions, consumed tokens, expired
sessions/leases, the provider retry deadline and a newer signed-in billing Checkout.
A separate two-case proof test rejects malformed hexadecimal signatures without
throwing and preserves email/purpose binding.

The explicit real-sandbox run passed all 15 recovery cases, including its remote
case. It creates a synthetic test customer, deliberately loses the successful
response, then recovers the same customer with Stripe's idempotency key and creates
one real sandbox Checkout. Replay retrieves that session; Stripe can change its URL
fragment without creating a new session. The test expires its Checkout and deletes
its synthetic customer afterward. It never completes Checkout or creates a live
payment. The normal suite skips that remote case.

The final Linux/ARM64 image `topiqu-readiness:20261104`, image ID
`2ff4d4b0710716f824c0a6088fd3b3a527353c3d3b39045fed0f621c24caf75e`,
built successfully without database credentials. Its entrypoint applied all 143
migrations to a newly created, isolated PostgreSQL database. Health/liveness passed;
the process uses Bun 1.4.4 as a non-root user. The base image's `node` command is a
symlink to Bun, not a separate Node runtime. Local verification covers ARM64; the
repository's Linux CI remains responsible for its runner architecture.

HTTP checks against that exact image verified signup creation and replay, a 400
response for malformed proof, single-use login consumption/rejection and recovery
without reminting the consumed token. Authentication requests used HTTPS forwarded
host/protocol headers, as a TLS-terminating proxy would. No test-database flag was
needed for these production-auth checks. All seven existing asset budgets passed:
entry JavaScript 394,007 bytes gzip and total CSS 45,451 bytes gzip. These are build
budgets, not new field Core Web Vitals measurements.

A fresh read-only live Stripe inspection confirmed nine active catalog Prices,
their amounts/Products/intervals, Customer Portal configuration and the existing
active webhook's event subscriptions. There were zero provider mutations. Reading
Dokploy's application environment returned 403 for the restricted domain token;
the handoff therefore preserves production auth and webhook signing secrets rather
than copying local assumptions. See [the exact ENV handoff](2026-11-04-release.md).

Final application checks after the recovery changes passed: full ESLint, Nuxt
typecheck, Prettier, OpenAPI and **4,065 tests in 503 files**. Nine files / 45 tests
remain intentionally skipped in the ordinary suite; the new remote recovery case
was verified separately through its explicit sandbox opt-in.

Five release-smoke scenarios passed against the same image, including SSR session
continuity, compressed assets, IPX restrictions and service-worker lifecycle. Wallet
pagination/scrolling passed on desktop Chromium and mobile WebKit, plus the three
authentication fixtures. The first mobile attempt correctly followed production
CSP's HTTPS upgrade and could not load chunks from a plain-HTTP loopback server.
The wallet rerun used only the local runtime override
`NUXT_SECURITY_HEADERS_CONTENT_SECURITY_POLICY_UPGRADE_INSECURE_REQUESTS=false`,
matching the existing CI test-build policy for HTTP. Other CSP directives remained
present. The production source and deployment handoff retain the HTTPS policy.

The corresponding landing passed all 28 tests, full ESLint, typecheck, Prettier and
OpenAPI validation. Four pre-existing formatting discrepancies were normalized;
the OpenAPI JSON was checked for semantic equality and the three server changes
only wrap existing expressions. Its Linux/ARM64 image
`topiqu-landing-readiness:20261104`, ID
`5f9e956676cd7f770a191432f5f8092cd767741fa650ab69db3816edfcdf85af`,
built with its existing pinned Bun 1.4.3. The repository's production-rendering smoke
passed both locales, all onboarding steps, documentation/changelog, the expected
404, domain syntax checks and every SSR image variant, including retina IPX output.

A final HTTP check connected those two real images over the isolated Docker
network, using native `NUXT_` landing overrides and the same synthetic signing
secret. Registration through the landing succeeded; after restarting **both**
containers, repeating the same verified details returned the original result and
left exactly one account and one blog in the isolated database. Consuming the token
at the app and then resubmitting through the landing returned sign-in without a
token. No Stripe key, mail credential or AI credential was present in either runtime
for this check. This verifies service-to-service configuration/recovery without
contacting payment, email or AI providers. The test containers and PostgreSQL were
stopped after verification; nothing was committed, pushed or deployed.

### Standards review

Two initial findings were fixed: recovery now respects a later signed-in billing
Checkout, and MAP documents the durable record, token derivation and retry limits.
The read-only recheck reported no remaining documented-standard or code-smell
findings in the recovery scope.

### Spec review

The independent read-only review reported no remaining findings in original trial
deadline, repeat-inbox eligibility, proof-before-replay, token consumption, stable
provider mutations or landing retry behavior. Neither axis certifies unrelated
code or production infrastructure. Zero remaining findings on each reviewed axis.
