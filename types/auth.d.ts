import type { DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface User extends DefaultUser {
    id: string
    name: string
    role: 'admin' | 'superadmin' | 'reader'
    clientSiteId: string
    plan: string
  }

  interface Session {
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    name: string
    role: 'admin' | 'superadmin' | 'reader'
    clientSiteId: string
    plan: string
  }
}
