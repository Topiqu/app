import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
}

await stubImports()

const { inScope } = await import('../../../server/utils/keywords/scope')

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

const site = { id: 's1', language: 'cs' as const, focus: 'RPG hry', audience: 'hráči', keywords: ['rpg', 'Larian'] }

describe('inScope', () => {
  beforeEach(() => {
    vi.stubGlobal('aiModel', (task: string) => task)
    vi.stubGlobal('recordAiUsage', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns the indexes of kept items and ignores numbers that do not exist', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { keep: [2, 9] }, usage: { totalTokens: 120 } } as never)
    await expect(
      inScope(site, ['GTA VI má datum vydání', 'Larian ukázal nové RPG'], 'NEWS_SCOPE_TOKENS'),
    ).resolves.toEqual([1])
    expect(recordAiUsage).toHaveBeenCalledWith('s1', 120, 'NEWS_SCOPE_TOKENS', expect.anything())
  })

  it('judges against the focus, numbered items and the narrow-scope rule', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { keep: [] }, usage: {} } as never)
    await inScope(site, ['GTA VI má datum vydání'], 'NEWS_SCOPE_TOKENS')
    const call = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string; instructions: string; model: string }
    expect(call.model).toBe('topicScope')
    expect(call.prompt).toContain('Focus: RPG hry')
    expect(call.prompt).toContain('1. GTA VI má datum vydání')
    expect(call.instructions).toContain('Sharing the broad category is not enough')
    expect(call.instructions).toContain('When in doubt, skip')
  })

  it('does not call the model for nothing', async () => {
    await expect(inScope(site, [], 'NEWS_SCOPE_TOKENS')).resolves.toEqual([])
    expect(generateText).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)
