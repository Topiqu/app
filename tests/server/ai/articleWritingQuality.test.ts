// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'
import { ARTICLE_QUALITY_EFFORT, ARTICLE_QUALITY_LEVELS } from '../../../shared/utils/articleQuality'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../../server/utils/ai/researchEvidence'), 'researchTopic')
  await stubNitroImports(import('../../../server/utils/ai/editorialPolicy'), 'editorialPolicy')
  await stubNitroImports(import('../../../server/utils/ai/articleQuality'), 'AUTHOR_ACCOUNT_RULE')
  await stubNitroImports(import('../../../server/utils/knowledge/retrieve'), 'retrieveKnowledge')
  await stubNitroImports(import('../../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../../server/utils/aiUsage'), 'recordAiUsage')
  await stubNitroImports(import('../../../server/utils/ai/articleUsage'), 'withArticleUsageStage')
  await stubNitroImports(import('../../../server/utils/articleGenerationAudit'), 'auditArticleStep')
  await stubNitroImports(import('../../../server/utils/ai/formats'), 'formatRules', 'selectedModulesFor')
}

await stubImports()

const { buildArticleConfig } = await import('../../../server/utils/ai/articleConfig')

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

beforeEach(stubImports)
