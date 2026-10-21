# Custom domain provisioning

Approved scope: Cloudflare for SaaS + Dokploy Application integration, DNS ownership,
O2O routing, origin certificates, setup UI, disconnect and scheduled reconciliation.
No provider mutations or production migration are authorized during implementation.

Architecture: a tenant-owned DomainConnection reserves each hostname uniquely and records
provider IDs, lifecycle, lease and cleanup state. Request routes use tenant policies;
the provisioner is an explicit system context after authorization. Provider operations
are bounded, secret-redacted and reconciled after ambiguous failures. Keep the current
live address until readiness is proven. Never infer ownership from shared Cloudflare IPs.

- [x] Add additive model/migration and generated ORM; protect provisioning fields from generic API writes.
- [x] Implement validated provider clients, safe probes and certificate validation.
- [x] Implement leased provisioning, cancellation, adoption safeguards and cleanup.
- [x] Integrate pending/current domain routes and periodic verification with cache invalidation.
- [x] Extend existing domain UI with provider validation, lifecycle, disconnect and certificate controls.
- [x] Cover state transitions, tenant boundaries, stale operations, provider failures and secret handling.
- [x] Run generation, focused tests, lint, i18n, contracts, typecheck and sequential production verification.
- [x] Document rollout, migration, staging/provider permissions and limitations.
- [x] Apply migration to the explicitly approved local test database and run PostgreSQL/browser scenarios.
- [ ] Verify real provider write compatibility with a dedicated hostname during authorized rollout.

Local verification: migration applied only to `topiqu_hardening_test_20261020`; four
PostgreSQL integration checks, seven domain browser/setup checks and five release-smoke
checks passed against the compiled Bun server. Billing is stubbed in the domain UI test;
it is not a live Stripe test. Cloudflare fallback and the existing pilot hostname's active
certificate were confirmed read-only. Dokploy domain-list access also passes after the
service permission correction. Provider write compatibility remains unverified. No remote
resources were modified.

Docker startup now packages the existing locked migration CLI and runs pending migrations
before Nitro. A Linux ARM64 image applied all 119 migrations to the new empty local
`topiqu_deploy_gate_test_20261021` database, became healthy, and restarted without duplicate
migration records. An unreachable database exited with code 1 before server startup.
The migration-gate/toolchain unit tests, lint, typecheck and formatting passed.

Ownership failures and infrastructure outages must be distinguished. A persistent old
TXT cannot detect a registrar ownership transfer that leaves DNS unchanged. New claims
always receive a fresh challenge. Existing manually configured resources require explicit
superadmin adoption and are never implicitly deleted. Customer certificate keys are never
returned or logged. Platform auth remains the management entry point until cross-domain
auth is explicitly verified; no insecure cross-domain cookie workaround.
