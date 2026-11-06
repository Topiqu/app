# AI allowances and CUSTOM billing

Implemented policy: `2026-11-04`, defined by `shared/utils/billingCatalog.ts`.
This document describes the working tree, not an already completed production rollout.

## Subscriptions and trials belong to a blog

Every ClientSite has its own subscription, article balance, AI usage and team capacity.
Blog creation is unlimited. The first eligible, verified owner/inbox receives the
14-day Premium trial; additional blogs are BASIC without another trial. Existing
canonical-inbox, disposable-email and registration rate-limit checks remain in force.
Deleting a blog does not make its inbox eligible for another trial.

The trial includes five article units and at most USD 1 in combined metered provider
capacity for the entire trial, shared by all members and operations. It never renews
daily. A paid period or explicit pack purchase is required to add paid capacity.

## Prices and seats

| Plan           |         Monthly | Annual, paid upfront | Team seats, including owner | Articles/month |
| -------------- | --------------: | -------------------: | --------------------------: | -------------: |
| BASIC          |            Free |                 Free |                           1 |              0 |
| PRO            |          USD 49 |           USD 470.40 |                           2 |             50 |
| PREMIUM        |          USD 99 |           USD 950.40 |                           3 |            100 |
| Managed CUSTOM | USD 199 minimum | USD 1,910.40 minimum |                   3 minimum |            100 |

CUSTOM is USD 159 including the owner plus USD 20 for each additional paid seat.
The minimum is three seats, so the actual minimum charge is USD 199, not USD 200.
Annual billing discounts both components by 20%: base USD 1,526.40 and USD 192 per
additional seat/year. Prices exclude applicable taxes.

Purchased capacity and occupied seats are separate. Invitations reserve capacity;
readers and followers do not. Inviting someone never charges a card. A billing-authorized
member explicitly previews and confirms additional capacity using a signed, five-minute
Stripe proration quote. Payment must succeed before extra seats become available.
Unused capacity may be reduced, with the lower amount billed next renewal and no
proration refund. A reduction below active members plus pending invitations is rejected.

Managed CUSTOM receives Premium features. Existing individually contracted CUSTOM
blogs have `paidTeamSeats = null` and retain their existing terms; this rollout does
not reprice them or infer a new paid seat quantity. Extra seats do not multiply AI,
article or storage allowances. Fixed-plan downgrades pause excess member access
without deleting memberships; an upgrade can restore access.

## Included usage and explicit top-ups

| Operation                           | Trial, whole trial | PRO/month | PREMIUM/month | Managed CUSTOM/month |
| ----------------------------------- | -----------------: | --------: | ------------: | -------------------: |
| Translations, one language each     |                 10 |        60 |           250 |                  250 |
| Short edits and prompt improvements |                 50 |       200 |           500 |                  500 |
| Visibility provider responses       |                 10 |         0 |           300 |                  300 |

A six-provider visibility check uses six responses. STANDARD/HIGH/ULTRA article
generation uses 1/2/3 article units. Annual subscribers receive monthly allowances.
Included usage expires at its period boundary; a trial stops at its deadline.
Counts are upper bounds; the internal cost guards below can still pause work.

The customer sees article units and operation counts, never provider dollars, tokens
or the cost guards. Exhausting a count rejects new work, shows the renewal and offers
an explicit purchase; reaching a cost guard shows a pause and alerts us. It never automatically invoices overage,
changes quality or renews a usage pack. Blocked translations retain a retry time;
a paid renewal or usage purchase clears it so normal queue processing can resume.

Existing article packs remain 5/USD 8.99, 12/USD 14.99 and 25/USD 22.49. Their
balances survive subscription/trial expiry. Each purchased grant has separate AI
funding accessible only to an article operation using that grant, so auxiliary
operations cannot spend it. An active AI plan is still required for generation.

Unused plan article units carry over in a non-expiring `ROLLOVER` grant while a
PRO/PREMIUM/CUSTOM plan is active, capped at twice the monthly allowance; the next
expiry pass trims them to a lower plan's cap or drops them off the paid AI plans.
Each carried unit brings USD 0.25 of article-only funding, above the USD 0.194
STANDARD worst case. Trial units and operation counts do not carry over.

Separate nonexpiring usage packs, usable with an active AI plan:

| Pack   | One-time price | Extra translations | Extra edits | Extra visibility responses | Internal provider funding |
| ------ | -------------: | -----------------: | ----------: | -------------------------: | ------------------------: |
| Small  |       USD 8.99 |                 10 |          50 |                         10 |                     USD 1 |
| Medium |      USD 14.99 |                 25 |         125 |                         25 |                     USD 2 |
| Large  |      USD 22.49 |                 50 |         250 |                         50 |                     USD 3 |

The usage-pack and auxiliary-count details were selected during the delegated
implementation; they are not a claim that these exact quantities had been separately
approved earlier. The server-owned catalog is authoritative for UI and verified
Checkout fulfillment. Purchased grants are idempotent by Checkout Session ID.

## Provider capacity and accounting

The AI cost guard (`BUDGET`) is 50% of the subscription base after discounts, excluding
taxes, seats and language add-ons. Annual base revenue is normalized over twelve monthly
slots: PRO USD 24.50/month or USD 19.60 on annual billing; PREMIUM USD 49.50 or USD 39.60;
CUSTOM USD 79.50 or USD 63.60. The trial guard is USD 2. Further discounts reduce these amounts. Mid-period
funding comes only from net paid plan prorations. Old invoices cannot overwrite a
newer tier's recurring baseline. Zero-dollar invoice receipts are retained too.

`AiAllowanceGrant`, `AiUsageReservation` and `AiAllowanceInvoice` are system-only
ledgers. Reservations lock the blog before allocating funds, then refund only
known unused capacity. Unknown provider outcomes and abandoned leases retain their
reservation. Known overruns become debt against later available capacity. A
settlement failure is reported and cannot turn an already delivered result into
a failed customer operation. Concurrent users share the same atomic balance.

`server/utils/ai/spend.ts` centralizes text, search, image and embedding reservations;
visibility requests use the same ledger. DataForSEO has its own `SEO` guard: USD 10 on
PRO, USD 20 on PREMIUM/CUSTOM and USD 1 in the trial per period. Provider attribution fails
closed without a blog context. Included paid periods require an invoice-backed
article grant, except explicit permanent/manual contracts. Annual catch-up requires
a confirmed paid-through boundary. The website import's existing global budget
remains an additional guard, not a replacement for per-blog capacity.

## Limits of the evidence

Provider rate snapshots are versioned; a pricing/model change requires reviewing
them. Missing itemized provider usage is charged conservatively. META/MISTRAL
visibility currently retains its conservative USD 0.50 reservation because exact
itemized cost is unavailable. This can stop usage earlier than its count limit.

No paid AI generation was run for cost calibration. The 50% figure is an enforcement
cap, not a measured gross margin or a guarantee that every advertised operation
count fits every possible prompt. A provider may bill above an estimate; the ledger
records that exposure and blocks further unreserved work. Whole-workflow p95 costs,
tax/refund policies and account-specific Stripe dunning still require operational
measurement. There is no newly implemented platform-wide trial acquisition pool.

## Deployment

The three `20261104*` migrations are additive and applied by the existing Docker
entrypoint before Nitro starts. `20261106200000_ai_cost_cap` adds the `SEO` kind and
scales stored monthly budgets and running invoice grants from 15% to 50% (×10/3). An image build never applies them. Configure the
four CUSTOM base/member Price IDs plus their two Product IDs, alongside existing
PRO/PREMIUM configuration. Keep live and sandbox credentials separate. No production
database, deployment, DNS or provider domain resources were changed by this work.

See [sandbox verification](stripe-sandbox-verification.md),
[release checks](stripe-release-checklist.md) and
[catalog activation](stripe-catalog-rollout.md).
