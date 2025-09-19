import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers/oauth'

import argon from 'argon2'
import { UAParser } from 'ua-parser-js'
import { NuxtAuthHandler } from '#auth'
import CredentialsProvider from 'next-auth/providers/credentials'

interface BaseOAuthProfile {
  id?: string
  sub?: string
  login?: string
  name?: string
  email?: string | null
  avatar_url?: string
  picture?: string
}

function mapProfile({ id, sub, login, name, email, avatar_url, picture }: BaseOAuthProfile) {
  return {
    id: (id ?? sub ?? login ?? '').toString(),
    name: name ?? login ?? '',
    email: email ?? '',
    avatarUrl: avatar_url ?? picture ?? (login ? `https://github.com/${login}.png` : null),
    role: 'reader' as const,
    clientSiteId: '',
    plan: 'BASIC' as const,
  }
}

function GoogleProvider<P extends BaseOAuthProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
  return {
    id: 'google',
    name: 'Google',
    type: 'oauth',
    wellKnown: 'https://accounts.google.com/.well-known/openid-configuration',
    authorization: { params: { scope: 'openid email profile' } },
    idToken: true,
    checks: ['pkce', 'state'],
    profile: (profile) => mapProfile(profile),
    ...options,
  }
}

async function fetchGitHubProfile(tokens: any) {
  const profile = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((res) => res.json())
  if (!profile.email) {
    const emails = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((res) => res.json())
    profile.email =
      emails.find((e: { primary: boolean; verified: boolean }) => e.primary && e.verified)?.email ??
      emails[0]?.email ??
      null
  }
  return profile
}

function GitHubProvider<P extends BaseOAuthProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    authorization: { url: 'https://github.com/login/oauth/authorize', params: { scope: 'read:user user:email' } },
    token: 'https://github.com/login/oauth/access_token',
    userinfo: {
      url: 'https://api.github.com/user',
      request: async ({ tokens }) => fetchGitHubProfile(tokens),
    },
    profile: (profile) => mapProfile(profile),
    ...options,
  }
}

const Credentials =
  import.meta.dev && 'default' in CredentialsProvider
    ? (CredentialsProvider.default as typeof CredentialsProvider)
    : CredentialsProvider

async function resolveGeo(ip: string) {
  if (!ip || ip === '::1' || ip.startsWith('127.')) {
    return { city: null, region: null, country: null }
  }

  try {
    const res = await fetch(`https://ipwho.is/${ip}`)
    const data = await res.json()
    if (!data.success) return { city: null, region: null, country: null }
    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country ?? null,
    }
  } catch {
    return { city: null, region: null, country: null }
  }
}

async function assignToken(token: any, user: any, plan: string, sessionId?: string) {
  token.id = user.id
  token.name = user.username
  token.email = user.email
  token.role = user.role
  token.clientSiteId = user.clientSiteId ?? ''
  token.plan = plan
  token.avatarUrl = user.avatarUrl
  if (sessionId) token.sessionId = sessionId
  return token
}

async function handleOAuthUser(token: any, existingUser: any, prisma: any, avatarValue: any) {
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        avatarUrl: existingUser.avatarUrl || (typeof avatarValue === 'string' ? avatarValue : null),
        lastLogin: new Date(),
      },
    })
    const plan = existingUser.clientSiteId
      ? ((await prisma.clientSite.findFirst({ where: { id: existingUser.clientSiteId }, select: { plan: true } }))
          ?.plan ?? 'BASIC')
      : 'BASIC'
    return assignToken(token, existingUser, plan)
  } else {
    let username = token.name ?? token.email?.split('@')[0] ?? 'user'
    if (await prisma.user.findUnique({ where: { username } })) {
      username = `${username}_${Date.now()}`
    }
    const newUser = await prisma.user.create({
      data: {
        email: token.email ?? '',
        username,
        avatarUrl: typeof avatarValue === 'string' ? avatarValue : null,
        role: 'reader',
        emailVerified: true,
        lastLogin: new Date(),
      },
    })
    return assignToken(token, newUser, 'BASIC')
  }
}

export default NuxtAuthHandler({
  secret: useRuntimeConfig().authSecret,
  providers: [
    Credentials({
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Heslo', type: 'password' } },
      async authorize(credentials, req) {
        const { email, password } = signInSchema.parse(credentials)
        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
          select: {
            id: true,
            username: true,
            role: true,
            password: true,
            clientSiteId: true,
            email: true,
            avatarUrl: true,
          },
        })
        if (!user || !user.password) return null
        if (!(await argon.verify(user.password, password))) return null
        let plan: string | null = null
        if (user.clientSiteId) {
          const clientSite = await prisma.clientSite.findFirst({
            where: { id: user.clientSiteId },
            select: { plan: true },
          })
          plan = clientSite!.plan
        }
        const ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? null
        const userAgent = req.headers?.['user-agent'] ?? null
        const parser = new UAParser(userAgent)
        const { device, os, browser } = parser.getResult()
        const geo = await resolveGeo(ip)
        const existingSession = await prisma.session.findFirst({
          where: {
            userId: user.id,
            ip,
            revoked: false,
            device: device?.model ?? device?.vendor ?? device?.type ?? 'Desktop',
            os: os?.name ? `${os.name} ${os.version ?? ''}`.trim() : null,
            browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : null,
          },
          select: { id: true },
        })
        let sessionId: string
        if (existingSession) {
          sessionId = existingSession.id
          await prisma.session.update({
            where: { id: sessionId },
            data: { lastUsedAt: new Date() },
          })
        } else {
          const session = await prisma.session.create({
            data: {
              userId: user.id,
              ip: ip ?? null,
              userAgent: userAgent ?? null,
              device: device?.model ?? device?.vendor ?? device?.type ?? 'Desktop',
              os: os?.name ? `${os.name} ${os.version ?? ''}`.trim() : null,
              browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : null,
              city: geo.city,
              region: geo.region,
              country: geo.country,
              lastUsedAt: new Date(),
              revoked: false,
            },
          })
          sessionId = session.id
          await logAction({
            action: 'SESSION_CREATE',
            userId: user.id,
            ip: ip ?? undefined,
            metadata: {
              sessionId,
              device: device?.model ?? device?.vendor ?? device?.type ?? 'Desktop',
              os: os?.name ? `${os.name} ${os.version ?? ''}`.trim() : undefined,
              browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : undefined,
              city: geo.city,
              region: geo.region,
              country: geo.country,
            },
          })
        }
        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
          clientSiteId: user.clientSiteId ?? '',
          plan: plan ?? 'BASIC',
          avatarUrl: user.avatarUrl,
          sessionId,
        }
      },
    }),
    GoogleProvider({ clientId: process.env.AUTH_GOOGLE_ID ?? '', clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '' }),
    GitHubProvider({ clientId: process.env.AUTH_GITHUB_ID ?? '', clientSecret: process.env.AUTH_GITHUB_SECRET ?? '' }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider) {
        const existingUser = await prisma.user.findUnique({ where: { email: token.email ?? '' } })
        const avatarValue = token.picture ?? token.image
        token = await handleOAuthUser(token, existingUser, prisma, avatarValue)
        token.provider = account.provider
      } else if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.role = user.role
        token.clientClientSiteId = user.clientSiteId
        token.plan = user.plan
        token.avatarUrl = user.avatarUrl
        token.sessionId = user.sessionId
      }
      return token
    },
    async session({ session, token }) {
      if (token.id) {
        session.user = {
          id: token.id,
          name: token.name,
          email: token.email,
          role: token.role,
          clientSiteId: token.clientSiteId,
          plan: token.plan,
          avatarUrl: token.avatarUrl,
          sessionId: token.sessionId,
        }
      }
      return session
    },
  },
})
