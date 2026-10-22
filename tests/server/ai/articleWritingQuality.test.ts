// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildArticleConfig } from '../../../server/utils/ai/articleConfig'
import { ARTICLE_QUALITY_EFFORT, ARTICLE_QUALITY_LEVELS } from '../../../shared/utils/articleQuality'

afterEach(() => vi.unstubAllGlobals())

const setup = (storedQuality: string | undefined) => {
  const model = vi.fn(() => 'selected-writer')
  vi.stubGlobal('aiModel', model)
  vi.stubGlobal('prisma', {
    clientSite: {
      findFirstOrThrow: async () => ({
        language: 'en',
        plan: 'PREMIUM',
        features: [{ isActive: true }],
        articleQuality: storedQuality,
      }),
    },
  })
  return model
}

const effortOf = (config: { providerOptions: { openai: { reasoningEffort: string } } }) =>
  config.providerOptions.openai.reasoningEffort

describe('article quality configuration', () => {
  it.each(ARTICLE_QUALITY_LEVELS)('writes %s with Luna at its own reasoning effort', async (quality) => {
    const model = setup(quality)
    const { config } = await buildArticleConfig('site-1', 'A useful article', { research: false })
    expect(model).toHaveBeenCalledWith('articleWriter')
    expect(config.model).toBe('selected-writer')
    expect(effortOf(config)).toBe(ARTICLE_QUALITY_EFFORT[quality])
  })

  it('keeps the quality captured at the start of a run when settings change during research', async () => {
    setup('STANDARD')
    const { config } = await buildArticleConfig('site-1', 'A useful article', {
      research: false,
      articleQuality: 'ULTRA',
    })
    expect(effortOf(config)).toBe('max')
  })

  it('defaults older settings to Standard', async () => {
    setup(undefined)
    const { config } = await buildArticleConfig('site-1', 'A useful article', { research: false })
    expect(effortOf(config)).toBe('high')
  })
})
