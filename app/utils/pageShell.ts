export type AppShell = 'dashboard' | 'product' | 'publication'
export type AppRole = string | undefined

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
