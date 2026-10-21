# Custom domains

Cloudflare for SaaS provides visitor-facing TLS. Dokploy Application configures per-host
Traefik routers and origin TLS. Both must be ready before changing the canonical domain.
Shared Cloudflare IPs are never proof of routing.

## Configuration and rollout

Run `bun run domains:check` from a matching source checkout with dependencies and the
server's outbound network access for read-only provider access checks. The runtime image
contains only compiled output, not this source script.
It validates the configured fallback and Dokploy domain-list access without printing secrets
or creating, modifying or deleting resources. It does not test write permissions.

Set server runtime variables from `.env.example`: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_FALLBACK_ORIGIN`, `DOMAIN_ROUTING_TARGET`,
`DOKPLOY_BASE_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APPLICATION_ID`,
`DOKPLOY_ORGANIZATION_ID`, `DOKPLOY_APPLICATION_PORT`, and
`DOMAIN_SECRETS_ENCRYPTION_KEY` (32 random bytes in Base64). Do not expose credentials
through public runtime config, image arguments, browser storage or logs.

Cloudflare needs SSL and Certificates Write for the specific SaaS zone. DNS write is
not needed: platform target/fallback DNS remains operator-managed. Dokploy needs domain
read/create/update/delete for this Application; own certificates also require certificate
read/create/update/delete. Permission granularity depends on Dokploy version/edition.
Docker, SSH, deployment and environment-write access are not used by this integration.

Use an absolute HTTPS panel URL at its root, without `/api`. Application/organization
IDs are server-controlled. Configure Full (strict), a proxied fallback and customer CNAME
target. Origin TLS must cover the actual customer SNI; edge activation does not fix a 526.

1. Back up the explicitly identified database and verify restore.
2. Deploy the image through the authorized release process. Its entrypoint applies
   `20261021180000_domain_connections` and any other pending committed migrations before
   starting the server; migration failure prevents startup. The additive domain migration
   does not change existing addresses. The restrictive foreign key preserves cleanup evidence.
3. Configure runtime secrets and confirm provider read access from the real server.
4. Test a dedicated hostname with DNS-only and O2O before general rollout.
5. Check origin TLS, both Cloudflare active states, signed routing, tenant isolation,
   retries, cancellation, disconnect and cache invalidation.

Mocked provider tests do not establish live permissions or installed API compatibility.
Never apply local migrations with an ambiguous database URL.

## Lifecycle

A unique DomainConnection reserves the hostname and a fresh Topiqu TXT challenge.
Only matching TXT authorizes provisioning. Refresh creates provider resources, exposes
their DNS validation records and checks activation. A nonce-bound HMAC probe over public
HTTPS proves routing to this application without exposing content. It uses the existing
DNS-pinned/private-network-blocking fetcher, byte limits and no redirects.

The live address stays unchanged until setup succeeds. Database leases serialize provider
operations. Cancellation/disconnect retain durable cleanup state. Unknown existing remote
objects require administrator review, including ambiguous POST success without a persisted
ID. A superadmin can explicitly attach exact, TXT-proven objects using `/api/domain/adopt`;
attached resources remain externally managed and are never automatically deleted.

The existing domain task retries setup/cleanup and rotates live checks with a per-run
time budget. Abandoned pending setup expires after seven days. Resolver/provider outages
do not prove lost ownership. Three confirmed missing-TXT checks suspend serving and restore
a former Topiqu subdomain when available, otherwise a fresh managed subdomain. The address
switch and cleanup request are atomic; subsequent setup requires fresh proof.
Persistent routing failures use the existing degradation/grace policy. Revocation/recovery
invalidates host caches. Administrators receive localized status notifications.

Only retired managed Topiqu hosts retain redirects. Retired custom hosts are disconnected,
so later owners do not inherit indefinite redirects. Explicit disconnect requires an
available managed fallback and disables serving before provider cleanup. Cleanup checks
tracked IDs and exact hostname/application identity, never suffix-based bulk deletion.
Disconnect and setup cancellation attempt provider cleanup immediately after committing
the safe address change. Failed or busy cleanup remains durable for the hourly task, and
the connection card allows a tenant-scoped retry after the blog has moved to its fallback.
Retired setup errors are cleared when disconnecting. Cleanup with no owned resources does
not require provider credentials. Reconnecting requires completed cleanup and a fresh TXT
challenge; this tenant's pending cleanup is distinct from another tenant's reservation.
Customer DNS records stay in the customer's DNS account and must be removed there.

DNS cannot detect a registrar ownership transfer that leaves all DNS records unchanged.
Old TXT and a stale provider active status cannot authorize a new tenant claim. Ownership
disputes need reviewed fresh proof. Do not describe periodic DNS checks as detecting sales.

## Own certificates and authentication

Certificate imports validate a matching key, validity, chain signatures/public trust, key
strength and exact single-host SAN. Additional SANs/wildcards are rejected because Traefik's
certificate store is shared. Self-signed and Cloudflare Origin CA chains are not currently
included in the supported public CA trust store. Cloudflare must also trust the origin.

Queued PEM/key material is AES-256-GCM encrypted with connection-bound AAD and cleared
after successful installation or cleanup. Back up the encryption key separately. Only
the tracked connection-named Dokploy certificate can be rotated. Metadata changes after
installation succeeds. Customers renew their own certificates; expiry notifications start
within 14 days. Visitor-facing certificates remain Cloudflare-managed; BYO edge certificates
are a separate Enterprise feature. Switching back to automatic origin TLS is not exposed.

Dashboard routes on custom hosts redirect to `app.<baseDomain>`. Platform cookies and
OAuth state cannot be shared with unrelated domains. This does not implement cross-domain
reader SSO; custom-host reader login needs a separate supported session design.

Provider failures are reduced to safe codes before reporting, removing request headers
and certificate bodies. Calls have deadlines, no credentialed redirects and no automatic
POST retries. Known partial resources are retained for retry; uncertain untracked resources
require explicit attachment. Rollback must retain connection records and IDs for recovery.
