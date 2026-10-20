import type { H3Event } from 'h3'
import type { SessionUser } from '~~/shared/types/auth'
import type { BetterAuthPlugin, GenericEndpointContext } from '@better-auth/core'

import { z } from 'zod'
import argon from 'argon2'
import { authenticator } from 'otplib'
import { betterAuth } from 'better-auth'
import { customSession } from 'better-auth/plugins'
import { setSessionCookie } from 'better-auth/cookies'
import { zenstackAdapter } from '@zenstackhq/better-auth'
import { APIError, createAuthEndpoint } from 'better-auth/api'

import { logAuthError } from './authErrorLogger'
import { isSecureAuth, sessionCookieDomain } from './authCookie'
import { headerRecord, initialTenant, sessionDevice, toSessionUser, uniqueUsername } from './session'

declare module 'h3' {
  interface H3EventContext {
    authUser?: SessionUser | null
  }
}

// Production pins no AUTH_ORIGIN: the OAuth redirect_uri follows the request host, which the tenant
// hop (`oauth-start`) always makes app.topiqu.com. The host list keeps a forged Host header out.
const devOrigins = isSecureAuth ? [] : ['http://localhost:*', 'http://*.localhost:*', 'http://127.0.0.1:*']
const baseURL = process.env.AUTH_ORIGIN || {
  allowedHosts: ['topiqu.com', '*.topiqu.com', ...devOrigins.map((url) => url.replace('http://', ''))],
  fallback: isSecureAuth ? 'https://app.topiqu.com' : 'http://localhost:3000',
  protocol: isSecureAuth ? ('https' as const) : ('http' as const),
}
const trustedOrigins = ['https://topiqu.com', 'https://*.topiqu.com', ...devOrigins]
if (process.env.AUTH_ORIGIN) trustedOrigins.push(new URL(process.env.AUTH_ORIGIN).origin)

// `@omit` hides tokens from every app query; only the adapter reads them back.
const authDb = prisma.$setOptions({
  ...prisma.$options,
  omit: {
    session: { token: false },
    account: { accessToken: false, refreshToken: false, idToken: false, password: false },
    verification: { value: false },
  },
})

const reject = (status: 'UNAUTHORIZED' | 'FORBIDDEN' | 'TOO_MANY_REQUESTS', code: string) =>
  new APIError(status, { code, message: code })

/** Opens a Better Auth session for a user our own credential check has already accepted. */
async function openSession(ctx: GenericEndpointContext, userId: string) {
  const user = await ctx.context.internalAdapter.findUserById(userId)
  const session = user && (await ctx.context.internalAdapter.createSession(user.id))
  if (!user || !session) throw reject('UNAUTHORIZED', 'session_not_created')
  await setSessionCookie(ctx, { session, user })
  return ctx.json({ ok: true })
}

const credentialsBody = z.object({ email: z.string(), password: z.string(), totp: z.string().optional() })

// Credentials stay on `User.password` (argon2, written by register/reset/profile), so sign-in is ours too.
const credentials = {
  id: 'credentials',
  endpoints: {
    signInCredentials: createAuthEndpoint(
      '/sign-in/credentials',
      { method: 'POST', body: credentialsBody, requireHeaders: true },
      async (ctx) => {
        const req = { headers: headerRecord(ctx.headers) }
        const parsed = signInSchema.pick({ email: true, password: true }).safeParse(ctx.body)
        if (!parsed.success) throw reject('UNAUTHORIZED', 'invalid_credentials')
        const email = normalizeLoginEmail(parsed.data.email)

        const limit = await checkLoginRateLimit(req, email, 'authorize')
        if (!limit.allowed) {
          await logLoginFailure(req, email, 'rate_limited', 'authorize')
          throw reject('TOO_MANY_REQUESTS', 'rate_limited')
        }

        // TODO: For proper multi-tenant isolation:
        // 1. Resolve 'clientSiteId' from req.headers.host (domain).
        // 2. Filter user by { email, clientSiteId } to ensure unique accounts per site.
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
          select: { id: true, password: true, clientSiteId: true, totpSecret: true, emailVerified: true },
        })
        const failure = credentialFailure(
          user,
          !!user?.password && (await argon.verify(user.password, parsed.data.password)),
        )
        if (failure) {
          await logLoginFailure(req, email, failure, 'authorize')
          throw failure === 'email_unverified'
            ? reject('FORBIDDEN', 'email_not_verified')
            : reject('UNAUTHORIZED', 'invalid_credentials')
        }
        if (!user) throw new Error('Credential decision invariant failed')

        if (user.totpSecret) {
          const code = (ctx.body.totp ?? '').replace(/\s/g, '')
          if (!code || !authenticator.verify({ token: code, secret: user.totpSecret })) {
            await logLoginFailure(req, email, 'totp_invalid', 'authorize')
            throw reject('UNAUTHORIZED', 'invalid_credentials')
          }
        }

        const response = await openSession(ctx, user.id)
        await logLoginSuccess(req, email, user.id, user.clientSiteId)
        return response
      },
    ),
    // Redeems the single-use token minted by onboarding checkout (and the dev console's impersonation).
    signInToken: createAuthEndpoint(
      '/sign-in/token',
      { method: 'POST', body: z.object({ token: z.string().min(1) }), requireHeaders: true },
      async (ctx) => {
        const { token } = ctx.body
        const user = await prisma.user.findFirst({
          where: { onboardingLoginToken: token, deletedAt: null },
          select: { id: true, onboardingLoginTokenExpiresAt: true },
        })
        if (!user?.onboardingLoginTokenExpiresAt || user.onboardingLoginTokenExpiresAt < new Date())
          throw reject('UNAUTHORIZED', 'token_expired')

        // Guarded on the token itself, so a replay or a concurrent redemption consumes nothing.
        const consumed = await prisma.user.updateMany({
          where: { id: user.id, onboardingLoginToken: token },
          data: { onboardingLoginToken: null, onboardingLoginTokenExpiresAt: null },
        })
        if (consumed.count === 0) throw reject('UNAUTHORIZED', 'token_expired')

        return openSession(ctx, user.id)
      },
    ),
  },
} satisfies BetterAuthPlugin

export const auth = betterAuth({
  appName: 'Topiqu',
  baseURL,
  secret: process.env.AUTH_SECRET || useRuntimeConfig().auth.secret,
  // The adapter types its client without options; the omit override only widens result rows.
  database: zenstackAdapter(authDb as unknown as Parameters<typeof zenstackAdapter>[0], { provider: 'postgresql' }),
  trustedOrigins,
  // Login limits live in `checkLoginRateLimit` (Valkey, `clientIp`); Better Auth's own limiter
  // reads the first X-Forwarded-For entry, which is the Cloudflare edge behind Traefik.
  rateLimit: { enabled: false },
  onAPIError: {
    errorURL: '/auth-error',
    // An APIError is an answered request (bad password, expired token), not a fault.
    onError: (error) => {
      if (!(error instanceof APIError)) logAuthError('BETTER_AUTH_ERROR', { error })
    },
  },
  logger: {
    log: (level, message) => {
      if (level === 'error') logAuthError('BETTER_AUTH_ERROR', { error: message })
    },
  },
  advanced: {
    useSecureCookies: isSecureAuth,
    crossSubDomainCookies: { enabled: !!sessionCookieDomain, domain: sessionCookieDomain?.slice(1) },
    database: { generateId: false },
  },
  user: {
    fields: { name: 'username', image: 'avatarUrl' },
    additionalFields: { role: { type: 'string', input: false, required: false } },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    fields: { ipAddress: 'ip' },
    additionalFields: {
      device: { type: 'string', input: false, required: false },
      os: { type: 'string', input: false, required: false },
      browser: { type: 'string', input: false, required: false },
      city: { type: 'string', input: false, required: false },
      region: { type: 'string', input: false, required: false },
      country: { type: 'string', input: false, required: false },
      clientSiteId: { type: 'string', input: false, required: false },
    },
  },
  account: {
    encryptOAuthTokens: true,
    // Linking needs a verified local email (Better Auth default) and, as neither provider is trusted,
    // a verified provider email too — so a password squatter can never absorb the victim's OAuth identity.
    accountLinking: { enabled: true },
  },
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    },
    github: {
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Only OAuth creates users here; registration has its own endpoint.
        before: async (user) => {
          if (!user.emailVerified) throw reject('FORBIDDEN', 'oauth_email_unverified')
          return { data: { ...user, name: await uniqueUsername(user.name, user.email) } }
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { deletedAt: true } })
          if (!owner || owner.deletedAt) throw reject('FORBIDDEN', 'account_deactivated')
          const device = await sessionDevice(headerRecord(ctx?.headers ?? ctx?.request?.headers))
          return {
            data: { ...session, ...device, ipAddress: device.ip, clientSiteId: await initialTenant(session.userId) },
          }
        },
        after: async (session) => {
          await prisma.user.update({ where: { id: session.userId }, data: { lastLogin: new Date() } })
          try {
            await logAction({
              action: 'SESSION_CREATE',
              userId: session.userId,
              ip: (session.ipAddress as string | null) ?? undefined,
              metadata: {
                sessionId: session.id,
                device: session.device ?? undefined,
                os: session.os ?? undefined,
                browser: session.browser ?? undefined,
                city: session.city ?? undefined,
                region: session.region ?? undefined,
                country: session.country ?? undefined,
              },
            })
          } catch (err) {
            await logger.error('audit:SESSION_CREATE failed', {
              source: 'audit',
              action: 'SESSION_CREATE',
              userId: session.userId,
              sessionId: session.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        },
      },
    },
  },
  plugins: [
    credentials,
    customSession(async ({ user, session }) => ({
      user: await toSessionUser(user, session),
      session: { id: session.id, expiresAt: session.expiresAt },
    })),
  ],
})

/** The signed-in user for this request, or null. Cached on the event. */
export const getSessionUser = async (event: H3Event): Promise<SessionUser | null> => {
  if (event.context.authUser !== undefined) return event.context.authUser
  // Refresh is left to `/api/auth/get-session`, the only caller that can hand the extended cookie back.
  const result = await auth.api.getSession({ headers: event.headers, query: { disableRefresh: true } })
  const activeUser =
    result?.user &&
    (await prisma.user.findFirst({ where: { id: result.user.id, deletedAt: null }, select: { id: true } }))
  event.context.authUser = activeUser ? result!.user : null
  return event.context.authUser
}
