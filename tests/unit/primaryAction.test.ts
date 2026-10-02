import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import appConfig from '../../app/app.config'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('primary action color', () => {
  it('paints solid primary buttons with the action token instead of the brand hue', () => {
    const solid = appConfig.ui.button.compoundVariants.find(
      (variant) => 'color' in variant && variant.color === 'primary' && variant.variant === 'solid',
    )
    expect(solid?.class).toContain('bg-action')
    expect(solid?.class).toContain('hover:bg-action/85')
  })

  it('makes the dashboard primary ink so links, icons, hovers and selected controls match the buttons', () => {
    const styles = source('app/assets/styles/main.css')

    expect(appConfig.ui.colors.primary).toBe('slate')
    expect(styles).toMatch(/:root\s*{[^}]*--ui-primary: var\(--ui-bg-inverted\);/s)
    expect(styles).not.toMatch(/\.dark\s*{[^}]*--ui-primary:/s)
    expect(styles).toMatch(/\.publication-surface\s*{[^}]*--ui-primary: var\(--topiqu-tenant-accent\);/s)
  })

  it('keeps ink in the dashboard and the tenant accent on publication surfaces', () => {
    const styles = source('app/assets/styles/main.css')

    expect(styles).toMatch(/@theme inline\s*{\s*--color-action: var\(--topiqu-action\);/)
    expect(styles).toMatch(/:root\s*{[^}]*--topiqu-action: var\(--ui-bg-inverted\);/s)
    expect(styles).toMatch(/\.publication-surface\s*{[^}]*--topiqu-action: var\(--ui-primary\);/s)
  })
})

describe('tenant brand scope', () => {
  it('puts the publication surface on <html> so teleported overlays inherit the brand', () => {
    const layout = source('app/layouts/default.vue')
    const styles = source('app/assets/styles/main.css')

    expect(layout).toMatch(/htmlAttrs: isPublicationSurface\.value\s*\?\s*{\s*class: 'publication-surface'/)
    expect(layout).not.toContain(':style="publicationStyle"')
    expect(styles).toContain('.dark.publication-surface {')
  })
})
