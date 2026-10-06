export type SessionRole = 'admin' | 'superadmin' | 'reader' | 'ai'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: SessionRole
  clientSiteId: string
  plan: string
  avatarUrl: string | null
  sessionId: string
}
