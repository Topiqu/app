import { createUnimport } from 'unimport'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

it('imports runtime values used inside TypeScript assertions in server modules', async () => {
  vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
  const { default: config } = await import('../../nuxt.config')
  const imports = config.nitro?.imports
  const context = createUnimport({
    parser: imports ? imports.parser : undefined,
    imports: [{ name: 'ARTICLE_FORMAT_NAMES', from: './formats' }],
  })
  const result = await context.injectImports(
    'const schema = z.enum(ARTICLE_FORMAT_NAMES as [ArticleFormat, ...ArticleFormat[]])',
    'server/utils/ai/topic.ts',
  )
  expect(result.imports).toEqual([expect.objectContaining({ name: 'ARTICLE_FORMAT_NAMES', from: './formats' })])
})
