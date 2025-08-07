import argon from 'argon2'
import { NuxtAuthHandler } from '#auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const Credentials =
  import.meta.dev && 'default' in CredentialsProvider
    ? (CredentialsProvider.default as typeof CredentialsProvider)
    : CredentialsProvider

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
          },
        })
        if (!user || !user.password) return null
        if (!(await argon.verify(user.password, password))) return null

        let plan = 'default' // Fallback hodnota pro plan
        if (user.clientSiteId) {
          const clientSite = await prisma.clientSite.findFirst({
            where: { id: user.clientSiteId },
            select: { plan: true },
          })
          plan = clientSite?.plan ?? 'default'
        }

        return {
          id: user.id,
          name: user.username,
          role: user.role,
          clientSiteId: user.clientSiteId ?? '',
          plan,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.role = user.role
        token.clientSiteId = user.clientSiteId
        token.plan = user.plan
      }
      return token
    },
    async session({ session, token }) {
      if (token.id && token.name) {
        session.user = {
          id: token.id,
          name: token.name,
          role: token.role,
          clientSiteId: token.clientSiteId,
          plan: token.plan,
        }
      }
      return session
    },
  },
})
