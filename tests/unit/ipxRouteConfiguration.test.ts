// @vitest-environment node
import type { Nitro } from 'nitropack'

import { loadNuxt } from 'nuxt'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

describe('installed Nuxt Image route registration', () => {
  it('adapts the real Nitro 2 handler while retaining generated IPX configuration', async () => {
    const root = process.cwd()
    const fixture = await mkdtemp(join(tmpdir(), 'topiqu-ipx-registration-'))
    let nuxt: Awaited<ReturnType<typeof loadNuxt>> | undefined
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    try {
      const { default: config } = await import('../../nuxt.config')
      // Register the installed module in its own empty project, without preparing/building
      // the application or assuming a filename extension the module never supplied.
      nuxt = await loadNuxt({
        cwd: fixture,
        dev: false,
        dotenv: false,
        overrides: {
          rootDir: fixture,
          workspaceDir: fixture,
          buildDir: join(fixture, '.nuxt'),
          modulesDir: [join(root, 'node_modules')],
          modules: ['@nuxt/image'],
          devtools: { enabled: false },
          telemetry: false,
          image: {
            provider: 'ipx',
            dir: join(root, 'public'),
            domains: ['cdn.example.test'],
            ipx: { baseURL: '/media-cache' },
          },
          nitro: { preset: 'bun', output: { dir: join(fixture, '.output') } },
        },
      })
      const nitro = nuxt._nitro as Nitro
      const registered = nitro.options.handlers.find(({ route }) => route === '/media-cache/**')
      expect(registered).toBeDefined()
      const imageModuleDir = dirname(fileURLToPath(import.meta.resolve('@nuxt/image')))
      expect(registered!.handler).toBe(join(imageModuleDir, 'runtime/server/routes/_ipx.legacy'))
      const generatedConfig = structuredClone(nitro.options.runtimeConfig.ipx)
      const custom = { route: '/custom-image/**', handler: '/fixture/custom-image.ts' }
      nitro.options.handlers.push(custom)

      await config.nitro!.hooks!['build:before']!(nitro)

      expect(registered!.handler).toBe(join(root, 'server/runtime/ipx.ts'))
      expect(nitro.options._config.handlers).toContainEqual(registered)
      expect(nitro.options.runtimeConfig.ipx).toEqual(generatedConfig)
      expect(nitro.options.runtimeConfig.ipx).toMatchObject({
        baseURL: '/media-cache',
        http: { domains: ['cdn.example.test'] },
      })
      expect(custom.handler).toBe('/fixture/custom-image.ts')
    } finally {
      await nuxt?.close()
      vi.unstubAllGlobals()
      // The target is exclusively this test's fresh mkdtemp directory.
      await rm(fixture, { recursive: true, force: true })
    }
  }, 60_000)
})
