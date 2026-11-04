# Stripe catalog and webhook rollout

## Prepared state, 2026-11-03

The live catalog now has PRO USD 49/month and USD 470.40/year. The old USD 39 and
USD 374.40 Prices remain available to their existing subscriptions and are listed
in the local `STRIPE_LEGACY_PRICE_PRO_IDS`; no subscription was repriced.
PREMIUM USD 99/month and USD 950.40/year and the USD 9/month translation-language
Price already matched the application.

CUSTOM base and additional-member Products/Prices have been created: USD 159/month
or USD 1,526.40/year for the base, and USD 20/month or USD 192/year per additional
member. The commercial minimum is the base plus two additional members: USD 199/month
or USD 1,910.40/year. The 2026-11-04 working tree implements managed CUSTOM checkout,
explicit paid-capacity changes and AI allowances. Existing individual CUSTOM
contracts remain unchanged. This implementation has not been deployed by the agent.

The active application webhook now subscribes to every event handled by the app:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.updated`, `customer.subscription.paused`,
`customer.subscription.resumed`, `customer.subscription.deleted`, `invoice.paid`
and `invoice.payment_succeeded`. Its URL, enabled state and signing secret remain
unchanged.

A second webhook is pinned to `2025-08-27.basil` and remains **disabled**. Its new
secret and endpoint ID are stored only in the ignored local `.env`, under
`STRIPE_WEBHOOK_SECRET_NEXT` and `STRIPE_WEBHOOK_ENDPOINT_NEXT`. The original
endpoint still inherits the account default, observed as `2026-06-24.dahlia`.

A separate active, non-default Customer Portal configuration allows changing price
between the current PRO/PREMIUM monthly and annual offers. Its ID is stored in
`STRIPE_PORTAL_CONFIGURATION`. It creates prorations, schedules decreases and
annual-to-monthly changes for the period end, and preserves payment-method updates,
invoice history and period-end cancellation. CUSTOM seat changes are not exposed.
The default portal configuration retains its original disabled plan-change feature;
the new app explicitly selects the staged configuration after deployment.

No Customer, Checkout Session, PaymentIntent, Invoice or Subscription was created,
modified or paid as part of this preparation. No production application environment,
database or deployment was changed.

## Operator-controlled activation

The existing active endpoint remains supported during this application rollout.
Enabling the staged versioned endpoint is a separate, optional migration; copying
its secondary secret does not enable it. The release can first use the existing
endpoint and primary secret. Follow steps 3–5 only when the operator chooses to
perform that version migration after the new handler is healthy.

1. Deploy the tested application with the corrected PRO Price IDs and both retired
   PRO IDs in `STRIPE_LEGACY_PRICE_PRO_IDS`. Include the expected Product IDs in
   `STRIPE_PRODUCT_PRO` and `STRIPE_PRODUCT_PREMIUM`. Also include
   `STRIPE_PRICE_CUSTOM`, `STRIPE_PRICE_CUSTOM_ANNUAL`, `STRIPE_PRICE_CUSTOM_MEMBER`,
   `STRIPE_PRICE_CUSTOM_MEMBER_ANNUAL`, `STRIPE_PRODUCT_CUSTOM` and
   `STRIPE_PRODUCT_CUSTOM_MEMBER` for self-service CUSTOM. The existing Docker
   entrypoint applies the five additive `20261104*` migrations before startup,
   including the system-only signup recovery record and original trial deadline.
   Keep the existing primary
   `STRIPE_WEBHOOK_SECRET`; add `STRIPE_WEBHOOK_SECRET_NEXT` and
   `STRIPE_PORTAL_CONFIGURATION` from the local secret configuration. Copy values
   through the deployment's secret environment, not logs or committed files. Do not
   replace the primary secret before the app accepts both.
2. Confirm the new app is healthy. Its offer validation must accept the configured
   active Prices, currency, billing interval, amount, product and Stripe mode.
   Confirm the portal uses the staged configuration. Do not purchase anything just
   to check configuration.
   Webhook verification must use the asynchronous SDK method: Bun loads Stripe's
   worker export, whose SubtleCrypto provider rejects synchronous verification.
   The release image is checked locally with synthetic endpoint signatures.
3. Enable the staged endpoint identified by `STRIPE_WEBHOOK_ENDPOINT_NEXT` in Stripe.
   Leave the original endpoint enabled during the overlap. The new app verifies
   both endpoint signatures and uses Checkout Session / Invoice IDs to deduplicate
   article grants across duplicate deliveries.
4. Check the versioned endpoint's delivery results in Stripe Workbench when a
   legitimate event occurs. Local signed fixtures verify handler logic but do not
   establish actual delivery. Do not manufacture live payments or mutate customer
   subscriptions for this check.
5. Once the new destination is confirmed, disable the original endpoint. Keep its
   secret during the retry/rollback window. After the old endpoint is retired and
   no old delivery needs processing, the operator may promote the next secret to
   primary and clear the secondary value. Never remove the retired Price IDs while
   existing contracts still use them.

Switching endpoints, deploying or changing the production secret environment is a
separate operator action. Catalog preparation is not evidence that those actions
have occurred. Subsequent sandbox renewal, decline, proration and signed-delivery
checks are recorded in [the sandbox verification](stripe-sandbox-verification.md),
with their explicit limits; they do not prove delivery to the production endpoint.
