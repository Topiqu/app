import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mainCss = readFileSync(resolve(process.cwd(), 'app/assets/styles/main.css'), 'utf8')
const appConfig = readFileSync(resolve(process.cwd(), 'app/app.config.ts'), 'utf8')

describe('centralized Nuxt UI styles', () => {
  it('defines semantic geometry and tenant tokens globally', () => {
    expect(mainCss).toContain('--topiqu-header-height: 4rem')
    expect(mainCss).toContain('--topiqu-surface-radius:')
    expect(mainCss).toContain('.publication-surface')
  })

  it('centralizes component variants in app.config', () => {
    for (const component of ['button', 'input', 'textarea', 'card', 'modal', 'table', 'dashboardSidebar']) {
      expect(appConfig).toContain(`${component}:`)
    }
  })
})
