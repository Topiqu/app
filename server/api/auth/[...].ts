import argon from 'argon2'
import CredentialsProvider from 'next-auth/providers/credentials'
import { signInSchema } from '../../../utils/auth'
import { NuxtAuthHandler } from '#auth'

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
        return {
          id: user.id,
          name: user.username,
          role: user.role,
          clientSiteId: user.clientSiteId ?? '',
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
        }
      }
      return session
    },
  },
})
