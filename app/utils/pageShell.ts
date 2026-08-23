export type AppShell = 'dashboard' | 'product' | 'publication'
export type AppRole = string | undefined

export const resolvePageShell = (shell: unknown): AppShell =>
  shell === 'dashboard' || shell === 'product' || shell === 'publication' ? shell : 'publication'

export const canRenderDashboardShell = (_shell: AppShell, role: AppRole, dashboardSidebar: unknown = true) =>
  dashboardSidebar !== false && (role === 'admin' || role === 'superadmin')
