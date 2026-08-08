export type AppShell = 'dashboard' | 'product' | 'publication'
export type AppRole = string | undefined

export const resolvePageShell = (shell: unknown): AppShell =>
  shell === 'dashboard' || shell === 'product' || shell === 'publication' ? shell : 'publication'

export const canRenderDashboardShell = (shell: AppShell, role: AppRole) =>
  shell === 'dashboard' && (role === 'admin' || role === 'superadmin')
