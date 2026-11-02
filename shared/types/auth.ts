import type { TenantScope, UiLanguage } from '~~/generated/zenstack/models'

export type SessionRole = 'admin' | 'superadmin' | 'reader' | 'ai'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: SessionRole
  clientSiteId: string
  plan: string
  /** Effective scopes on the active tenant; owners and superadmins get every scope. */
  scopes: TenantScope[]
  avatarUrl: string | null
  sessionId: string
  language?: UiLanguage
  theme?: 'light' | 'dark'
}
