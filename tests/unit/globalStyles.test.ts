import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const baseScss = readFileSync(resolve(process.cwd(), 'app/assets/styles/base.scss'), 'utf8').replace(/\/\/.*$/gm, '')

describe('base.scss dialog rules', () => {
  // The transparent wrapper is a HeadlessUI Dialog detail; an unscoped match once wiped the
  // background off the editor popovers (tags, release date), which also carry role="dialog".
  it('keeps the transparent background scoped to HeadlessUI dialog roots', () => {
    const selectors = [...baseScss.matchAll(/([^{}]*)\{[^{}]*background-color:\s*transparent/g)].map(([, selector]) =>
      selector.trim(),
    )

    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain("[id^='headlessui-dialog-']")
    }
  })

  it('paints the dialog panel in both themes', () => {
    const panelRules = baseScss.match(/\[id\^='headlessui-dialog-panel'\]/g) ?? []
    expect(panelRules.length).toBe(2)
  })
})
