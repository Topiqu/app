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
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { username, password } = signInSchema.parse(credentials)
        const user = await prisma.user.findFirst({
          where: { username },
          select: { id: true, username: true, role: true, password: true },
        })
        if (!user || !user.id || typeof user.id !== 'string') return null
        if (!(await argon.verify(user.password, password))) return null
        return { id: user.id, name: user.username, role: user.role }
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
      }
      return token
    },
    async session({ session, token }) {
      if (token.id && token.name) {
        session.user = { id: token.id, name: token.name, role: token.role }
      }
      return session
    },
  },
})
