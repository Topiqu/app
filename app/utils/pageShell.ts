import { isRootHost } from '~~/shared/utils/domain'

export type AppShell = 'dashboard' | 'product' | 'publication'
export type AppRole = string | undefined

/** The platform's own host, or the local dev server. */
export const isPlatformHost = (hostname: string, baseDomain: string) =>
  isRootHost(hostname, baseDomain) || ['localhost', '127.0.0.1'].includes(hostname)

/** The agency console belongs to the person, not a blog, so someone without a blog opens it too. */
export const canOpenAgencyWithoutBlog = (role: AppRole, platformHost: boolean) => role === 'reader' && platformHost

export const resolvePageShell = (shell: unknown): AppShell =>
  shell === 'dashboard' || shell === 'product' || shell === 'publication' ? shell : 'publication'

export const canRenderDashboardShell = (
  role: AppRole,
  context: {
    platformHost: boolean
    hostTenantId?: string | null
    sessionTenantId?: string | null
    dashboardSidebar?: unknown
  },
) =>
  context.dashboardSidebar !== false &&
  (role === 'superadmin' ||
    (role === 'admin' &&
      (context.platformHost || Boolean(context.hostTenantId && context.hostTenantId === context.sessionTenantId))))
