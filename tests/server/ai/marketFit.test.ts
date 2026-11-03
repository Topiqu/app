import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../../shared/utils/keywordPlan'), 'keywordMarketsFor')
  await stubNitroImports(import('../../../shared/utils/language'), 'LANGUAGE_NAMES')
  await stubNitroImports(import('../../../shared/utils/articleBlocks'), 'htmlToText')
  await stubNitroImports(import('../../../shared/utils/articleTranslations'), 'MARKET_FIT_VERDICTS', 'readMarketFit')
}

await stubImports()

const { generateStructuredText } = vi.hoisted(() => ({
  generateStructuredText: vi.fn<(typeof import('ai'))['generateText']>(),
}))

vi.mock('ai', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('ai')>()
  return { ...sdk, generateText: (options: Parameters<typeof sdk.generateText>[0]) => generateStructuredText(options) }
})

const { assessMarketFit, marketFitInstructions, marketReaders } = await import('../../../server/utils/ai/marketFit')
const { readMarketFit } = await import('../../../shared/utils/articleTranslations')

const recordAiUsage = vi.fn()

beforeEach(async () => {
  await stubImports()
  vi.stubGlobal('aiModel', (task: string) => task)
  vi.stubGlobal('recordAiUsage', recordAiUsage)
})
afterEach(() => {
  vi.unstubAllGlobals()
  generateStructuredText.mockReset()
  recordAiUsage.mockReset()
})

const article = {
  id: 'article-1',
  language: 'cs' as const,
  title: 'Kolik stojí stavební povolení v roce 2027',
  excerpt: 'Poplatky stavebního úřadu.',
  answer: null,
  content: '<h2>Poplatky</h2><p>Stavební úřad účtuje&nbsp;správní poplatek.</p>',
}

describe('marketReaders', () => {
  it('names the countries of the keyword markets and leaves GLOBAL out', () => {
    expect(marketReaders('es')).toBe('Spanish (Spain) readers in Spain')
    expect(marketReaders('de')).toBe('German readers in Germany, Austria, Switzerland')
  })
})

describe('marketFitInstructions', () => {
  it('describes both markets and asks for the reason in the source language', () => {
    const instructions = marketFitInstructions('cs', 'es')
    expect(instructions).toContain('for Spanish (Spain) readers in Spain')
    expect(instructions).toContain('written for Czech readers in Czechia')
    expect(instructions).toContain('Write reason in Czech')
  })
})

describe('readMarketFit', () => {
  it('rejects anything without a known verdict', () => {
    expect(readMarketFit(null)).toBeNull()
    expect(readMarketFit({ verdict: 'MAYBE', reason: 'x' })).toBeNull()
  })

  it('drops blank and non-string passages', () => {
    expect(readMarketFit({ verdict: 'ADAPT', reason: 'r', localPassages: ['Dotace NZÚ', ' ', 3] })).toEqual({
      verdict: 'ADAPT',
      reason: 'r',
      localPassages: ['Dotace NZÚ'],
    })
  })
})

describe('assessMarketFit', () => {
  it('sends the article as text and records the usage with the verdict', async () => {
    generateStructuredText.mockResolvedValueOnce({
      output: { verdict: 'SKIP', reason: 'Popisuje český stavební zákon.', localPassages: [] },
      usage: { totalTokens: 321 },
    } as never)

    const fit = await assessMarketFit(article, 'es', 'site-1')

    expect(fit).toEqual({ verdict: 'SKIP', reason: 'Popisuje český stavební zákon.', localPassages: [] })
    const call = generateStructuredText.mock.calls[0]![0]
    expect(call.model).toBe('marketFit')
    expect(call.prompt).toContain('# Kolik stojí stavební povolení v roce 2027')
    expect(call.prompt).toContain('Stavební úřad účtuje správní poplatek.')
    expect(call.prompt).not.toContain('<p>')
    expect(recordAiUsage).toHaveBeenCalledWith(
      'site-1',
      321,
      'ASSESS_MARKET_FIT',
      expect.objectContaining({ articleId: 'article-1', targetLang: 'es', verdict: 'SKIP' }),
    )
  })

  it('propagates provider errors so the caller decides', async () => {
    generateStructuredText.mockRejectedValueOnce(new Error('overloaded'))
    await expect(assessMarketFit(article, 'es', 'site-1')).rejects.toThrow('overloaded')
    expect(recordAiUsage).not.toHaveBeenCalled()
  })
})
