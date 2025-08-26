import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers/oauth'

import argon from 'argon2'
import { NuxtAuthHandler } from '#auth'
import CredentialsProvider from 'next-auth/providers/credentials'

interface GoogleProfile {
  sub: string
  name: string
  email: string
  picture?: string
}

interface GitHubProfile {
  id: string
  login: string
  email: string | null
  avatar_url: string
  name?: string
}

function GoogleProvider<P extends GoogleProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
  return {
    id: 'google',
    name: 'Google',
    type: 'oauth',
    wellKnown: 'https://accounts.google.com/.well-known/openid-configuration',
    authorization: { params: { scope: 'openid email profile' } },
    idToken: true,
    checks: ['pkce', 'state'],
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        role: 'reader',
        clientSiteId: '',
        plan: 'BASIC',
      }
    },
    style: { logo: '/google.svg', bg: '#fff', text: '#000', logoDark: '/google.svg', bgDark: '#fff', textDark: '#000' },
    ...options,
  }
}

function GitHubProvider<P extends GitHubProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    authorization: {
      url: 'https://github.com/login/oauth/authorize',
      params: { scope: 'read:user user:email' },
    },
    token: 'https://github.com/login/oauth/access_token',
    userinfo: {
      url: 'https://api.github.com/user',
      async request({ tokens, provider }: { tokens: any; provider: any }) {
        const profile = await fetch(provider.userinfo?.url as string, {
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
      },
    },
    profile(profile) {
      return {
        id: profile.id.toString(),
        name: profile.name ?? profile.login,
        email: profile.email ?? '',
        image: profile.avatar_url || `https://github.com/${profile.login}.png`,
        role: 'reader',
        clientSiteId: '',
        plan: 'BASIC',
      }
    },
    style: {
      logo: '/github.svg',
      bg: '#24292e',
      text: '#fff',
      logoDark: '/github.svg',
      bgDark: '#24292e',
      textDark: '#fff',
    },
    ...options,
  }
}

const Credentials =
  import.meta.dev && 'default' in CredentialsProvider
    ? (CredentialsProvider.default as typeof CredentialsProvider)
    : CredentialsProvider

async function handleOAuthUser(token: any, existingUser: any, prisma: any, avatarKey: string, avatarValue: any) {
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        avatarUrl: typeof avatarValue === 'string' ? avatarValue : existingUser.avatarUrl,
        lastLogin: new Date(),
      },
    })
    token.id = existingUser.id
    token.name = existingUser.username
    token.email = existingUser.email
    token.role = existingUser.role
    token.clientSiteId = existingUser.clientSiteId ?? ''
    token.plan = existingUser.clientSiteId
      ? ((await prisma.clientSite.findFirst({ where: { id: existingUser.clientSiteId }, select: { plan: true } }))
          ?.plan ?? 'BASIC')
      : 'BASIC'
  } else {
    let username = token.name ?? token.email?.split('@')[0] ?? 'user'
    const usernameExists = await prisma.user.findUnique({ where: { username } })
    if (usernameExists) {
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
    token.id = newUser.id
    token.name = newUser.username
    token.email = newUser.email
    token.role = newUser.role
    token.clientSiteId = ''
    token.plan = 'BASIC'
  }
  return token
}

export default NuxtAuthHandler({
  secret: useRuntimeConfig().authSecret,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Heslo', type: 'password' },
      },
      async authorize(credentials) {
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

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
          clientSiteId: user.clientSiteId ?? '',
          plan: plan ?? 'BASIC',
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === 'github' || account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: token.email ?? '' },
        })
        const avatarKey = account.provider === 'google' ? 'picture' : 'picture'
        const avatarValue = token[avatarKey]
        token = await handleOAuthUser(token, existingUser, prisma, avatarKey, avatarValue)
        token.provider = account.provider
      } else if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.role = user.role
        token.clientSiteId = user.clientSiteId
        token.plan = user.plan
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
        }
      }
      return session
    },
  },
})
