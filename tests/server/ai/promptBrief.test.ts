import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enhancePrompt, plainTextBrief } from '../../../server/utils/ai/enhance'

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

beforeEach(() => vi.stubGlobal('aiModel', (task: string) => task))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(generateText).mockReset()
})

describe('plain article brief', () => {
  it('removes Markdown emitted by prompt enhancement before filling the textarea', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```markdown\n## Úhel\n**Vysvětlete** rozdíl.\n- Uveďte příklad.\n```',
      usage: {},
    } as never)

    expect((await enhancePrompt('Rozdíl', 'sharpen')).text).toBe('Úhel\nVysvětlete rozdíl.\n• Uveďte příklad.')
    expect(String(vi.mocked(generateText).mock.calls[0]![0].instructions)).toContain('plain text only')
    expect(plainTextBrief('**Důležité** a `konkrétní`')).toBe('Důležité a konkrétní')
  })
})
