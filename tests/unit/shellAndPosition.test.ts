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
    ['dashboard', 'admin', true],
    ['dashboard', 'superadmin', true],
    ['dashboard', 'user', false],
    ['dashboard', undefined, false],
    ['publication', 'admin', false],
    ['product', 'superadmin', false],
  ] as const)('renders %s for %s: %s', (shell, role, expected) => {
    expect(canRenderDashboardShell(shell, role)).toBe(expected)
  })
})

describe('DevConsole position persistence', () => {
  it('clamps persisted coordinates into the current viewport', () => {
    expect(
      clampDevConsolePosition({ x: 2000, y: -100 }, { width: 1440, height: 900 }, { width: 240, height: 300 }),
    ).toEqual({ x: 1192, y: 72 })
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
