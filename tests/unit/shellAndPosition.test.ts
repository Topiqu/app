import { describe, expect, it } from 'vitest'

import { canRenderDashboardShell, resolvePageShell } from '../../app/utils/pageShell'
import { clampDevConsolePosition, readDevConsolePosition } from '../../app/utils/devConsolePosition'

describe('application shell contract', () => {
  it.each([
    ['dashboard', 'dashboard'],
    ['product', 'product'],
    ['publication', 'publication'],
    [undefined, 'publication'],
    ['legacy', 'publication'],
  ] as const)('resolves %s to %s', (input, expected) => {
    expect(resolvePageShell(input)).toBe(expected)
  })

  it.each([
    ['admin', true],
    ['superadmin', true],
    ['user', false],
    [undefined, false],
  ] as const)('renders the dashboard for %s: %s', (role, expected) => {
    expect(canRenderDashboardShell(role, { platformHost: true })).toBe(expected)
  })

  it('lets auth and invitation routes explicitly suppress the role shell', () => {
    expect(canRenderDashboardShell('admin', { platformHost: true, dashboardSidebar: false })).toBe(false)
    expect(canRenderDashboardShell('superadmin', { platformHost: true, dashboardSidebar: false })).toBe(false)
  })

  it('only shows tenant administration when the host matches the active authorized tenant', () => {
    expect(canRenderDashboardShell('admin', { platformHost: false, hostTenantId: 'own', sessionTenantId: 'own' })).toBe(
      true,
    )
    expect(
      canRenderDashboardShell('admin', { platformHost: false, hostTenantId: 'other', sessionTenantId: 'own' }),
    ).toBe(false)
    expect(canRenderDashboardShell('admin', { platformHost: false, hostTenantId: 'other' })).toBe(false)
    expect(
      canRenderDashboardShell('reader', { platformHost: false, hostTenantId: 'own', sessionTenantId: 'own' }),
    ).toBe(false)
  })

  it('fails closed on unresolved tenant hosts but preserves platform and superadmin access', () => {
    expect(canRenderDashboardShell('admin', { platformHost: false, sessionTenantId: 'own' })).toBe(false)
    expect(canRenderDashboardShell('admin', { platformHost: true, sessionTenantId: 'own' })).toBe(true)
    expect(canRenderDashboardShell('superadmin', { platformHost: false, hostTenantId: 'other' })).toBe(true)
  })
})

describe('DevConsole position persistence', () => {
  it('clamps persisted coordinates into the current viewport', () => {
    expect(
      clampDevConsolePosition({ x: 2000, y: -100 }, { width: 1440, height: 900 }, { width: 240, height: 300 }),
    ).toEqual({ x: 1192, y: 8 })
  })

  it('rejects malformed stores and coordinates', () => {
    const fallback = { x: 304, y: 80 }
    expect(readDevConsolePosition('broken', 'desktop', fallback)).toEqual(fallback)
    expect(
      clampDevConsolePosition(
        { x: Number.NaN, y: 'bad' },
        { width: 800, height: 600 },
        { width: 240, height: 100 },
        fallback,
      ),
    ).toEqual(fallback)
  })
})
