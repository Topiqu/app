# Authentication on custom domains

An active verified custom hostname supports email/password login with the existing
email-verification, TOTP and login limits. Its session cookie is Secure in production,
HttpOnly, SameSite=Lax and host-only. Its signing key is derived from `AUTH_SECRET`,
the exact origin and tenant ID. Platform sessions continue to use `.topiqu.com` sharing.
Cookies cannot be copied between unrelated domains, including between a custom host and
the platform. A domain changing tenant ownership changes its signing key.

Each auth request checks the current canonical, verified, nondeleted site. Disconnecting
or replacing a domain denies further authentication there, even if its auth instance
was previously cached. Membership is still checked by the existing session projection
and authorization utilities. Signing in on someone else's custom blog does not open
the user's other blog's administrative context.
Custom-host sessions are constrained on every read, not just at creation: switching
their session tenant cannot expose another blog's admin context. Global superadmin
privileges stay on the platform; a custom-host session only receives its explicit local
membership permissions.

## Central sign-in and Google/GitHub

The custom-domain form offers Continue with Topiqu. Google/GitHub buttons use the same
handoff because their registered callback remains on `app.topiqu.com`. No per-customer
OAuth redirect registration is needed.

1. A same-origin POST on the custom host records a ten-minute request and stores a
   random browser proof in an HttpOnly cookie on that host. Only its hash is stored.
2. The browser navigates to the central origin. The user signs in if necessary and
   explicitly confirms the account and destination hostname.
3. A same-origin authenticated POST issues a 60-second code. Only its hash is stored,
   bound to the destination origin, tenant and current central session.
4. The destination verifies the code, browser proof, active domain and source session,
   consumes the request atomically, creates a new local session and redirects locally.

No source session token or password is sent to the destination. A code stolen from a
URL is insufficient without the initiating browser's proof. The public Better Auth
route does not expose the internal transfer sign-in endpoint. Completion responses use
no-store and no-referrer; Sentry scrubs transfer query strings, bodies and cookies.
Unfinished expired tickets are cleaned in batches of at most 50 on subsequent starts,
separately from OAuth and password-reset records.

If a request expires, the user starts again on the blog. A change of canonical hostname
or tenant, revoked central session, invalid proof or reused code fails closed.

## Configuration and verification

Production uses `https://app.topiqu.com` by default. If `AUTH_ORIGIN` is pinned, it must
identify the central auth origin, not a customer hostname. Locally include the actual
port, for example `http://localhost:3001`. Keep `AUTH_SECRET` stable and server-only.
There are no additional environment variables, dependencies or database migrations.

Targeted tests cover real credentials, SSR reloads, host-only cookies, cross-host cookie
replay rejection, explicit central confirmation and one-time completion. Provider login
still requires a smoke test with the real Google/GitHub application configuration after
deployment. The handoff does not change LinkedIn/Search Console integration OAuth flows.
Signing out affects the current origin's session; it is not global single logout.
