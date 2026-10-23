// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('native Bun entry selection', () => {
  it('uses the authored lifecycle entry only for the resolved Bun preset', async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    const config = (await import('../../nuxt.config')).default
    const select = config.nitro!.hooks!['rollup:before']!
    for (const preset of ['bun', 'nitro-dev', 'nitro-prerender', 'node-server']) {
      const nitro = { options: { preset, entry: 'original-entry' } }
      const rollup = { input: 'original-input' }
      await select(nitro as never, rollup as never)
      if (preset === 'bun') {
        expect(nitro.options.entry).toMatch(/\/server\/runtime\/bun\.ts$/)
        expect(rollup.input).toBe(nitro.options.entry)
      } else {
        expect(nitro.options.entry).toBe('original-entry')
        expect(rollup.input).toBe('original-input')
      }
    }
  })
})
