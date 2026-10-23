// @vitest-environment node
import type { Nitro } from 'nitropack'

import { loadNuxt } from 'nuxt'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('installed OG guarded-fetch registration', () => {
  it('wraps the real module-selected Node binding without replacing its DNS transport', async () => {
    const root = process.cwd()
    const fixture = await mkdtemp(join(tmpdir(), 'topiqu-og-fetch-registration-'))
    let nuxt: Awaited<ReturnType<typeof loadNuxt>> | undefined
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    try {
      const { default: config } = await import('../../nuxt.config')
      nuxt = await loadNuxt({
        cwd: fixture,
        dev: false,
        dotenv: false,
        overrides: {
          rootDir: fixture,
          workspaceDir: fixture,
          buildDir: join(fixture, '.nuxt'),
          modulesDir: [join(root, 'node_modules')],
          modules: ['nuxt-og-image'],
          devtools: { enabled: false },
          telemetry: false,
          ogImage: { enabled: true, runtimeCacheStorage: true, security: { secret: 'synthetic-og-fixture-only' } },
          nitro: { preset: 'bun', output: { dir: join(fixture, '.output') } },
        },
      })
      const nitro = nuxt._nitro as Nitro
      const moduleDir = dirname(fileURLToPath(import.meta.resolve('nuxt-og-image')))
      const upstream = join(moduleDir, 'runtime/server/og-image/bindings/fetch/node')
      expect(nitro.options.alias['#og-image/bindings/fetch']).toBe(upstream)
      const readPolicy = () => {
        const runtime = nitro.options.runtimeConfig['nuxt-og-image']
        return {
          maxDimension: runtime.security.maxDimension,
          fetchTimeout: runtime.security.imageFetchTimeout,
          renderTimeout: runtime.security.renderTimeout,
        }
      }
      const generatedPolicy = readPolicy()
      await config.nitro!.hooks!['build:before']!(nitro)
      expect(nitro.options.alias['#topiqu-og-fetch-upstream']).toBe(upstream)
      expect(nitro.options.alias['#og-image/bindings/fetch']).toBe(join(root, 'server/runtime/ogFetch.ts'))
      expect(readPolicy()).toEqual(generatedPolicy)
      // A repeated build hook must preserve the original binding instead of recursing.
      await config.nitro!.hooks!['build:before']!(nitro)
      expect(nitro.options.alias['#topiqu-og-fetch-upstream']).toBe(upstream)
    } finally {
      await nuxt?.close()
      await rm(fixture, { recursive: true, force: true })
    }
  }, 60_000)

  it.each([
    '/fixture/nuxt-og-image/dist/runtime/server/og-image/bindings/fetch/node.js',
    'C:\\fixture\\nuxt-og-image\\dist\\runtime\\server\\og-image\\bindings\\fetch\\node',
  ])('recognizes the selected Node binding %s', async (path) => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    const config = (await import('../../nuxt.config')).default
    const alias: Record<string, string> = { '#og-image/bindings/fetch': path }
    await config.nitro!.hooks!['build:before']!({ options: { alias, handlers: [] } } as unknown as Nitro)
    expect(alias['#topiqu-og-fetch-upstream']).toBe(path)
    expect(alias['#og-image/bindings/fetch']).toMatch(/\/server\/runtime\/ogFetch.ts$/)
  })

  it.each([
    undefined,
    '/fixture/custom-fetch.ts',
    '/fixture/nuxt-og-image/dist/runtime/server/og-image/bindings/fetch/web',
  ])('preserves an absent, custom or web transport %s', async (path) => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    const config = (await import('../../nuxt.config')).default
    const alias: Record<string, string> = path ? { '#og-image/bindings/fetch': path } : {}
    await config.nitro!.hooks!['build:before']!({ options: { alias, handlers: [] } } as unknown as Nitro)
    expect(alias['#og-image/bindings/fetch']).toBe(path)
    expect(alias['#topiqu-og-fetch-upstream']).toBeUndefined()
  })
})
