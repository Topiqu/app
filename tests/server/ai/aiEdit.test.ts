import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { generateObject, generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { briefQuestions, enhancePrompt, rewritePassage, sanitizePassage } from '../../../server/utils/ai/enhance'

vi.mock('ai', () => ({ generateObject: vi.fn(), generateText: vi.fn() }))

beforeEach(() => vi.stubGlobal('aiModel', (task: string) => task))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(generateText).mockReset()
  vi.mocked(generateObject).mockReset()
})

describe('AI text edits', () => {
  it('returns only the passage markup, without scripts, attributes or other tags', () => {
    expect(
      sanitizePassage(
        '<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="https://a.test" class="c">ok</a><img src=x><script>1</script></p>',
      ),
    ).toBe('<p>Hi <a>bad</a> <a href="https://a.test">ok</a></p>')
  })

  it('strips a code fence around the rewritten passage and sanitizes it', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```html\n<p>Short <strong>text</strong><iframe src="x"></iframe></p>\n```',
      usage: { totalTokens: 5 },
    } as never)
    const { html } = await rewritePassage('<p>Long text</p>', 'shorten')
    expect(html).toBe('<p>Short <strong>text</strong></p>')
    expect(vi.mocked(generateText).mock.calls[0]![0]).toMatchObject({ model: 'textEdit' })
  })

  it('uses the preset instruction for a brief edit', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: ' Fixed brief ', usage: {} } as never)
    expect((await enhancePrompt('brief', 'grammar')).text).toBe('Fixed brief')
    expect(String(vi.mocked(generateText).mock.calls[0]![0].instructions)).toContain('Fix spelling, grammar')
  })

  it('asks questions instead of inventing the author’s facts', async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: { questions: ['When did you start?'] }, usage: {} } as never)
    expect((await briefQuestions('We built a house', 'story')).questions).toEqual(['When did you start?'])
    expect(String(vi.mocked(generateObject).mock.calls[0]![0].instructions)).toContain('web research cannot answer')
  })
})

describe('author first-hand account', () => {
  const article = readFileSync(resolve(process.cwd(), 'server/utils/ai/article.ts'), 'utf8')
  const quality = readFileSync(resolve(process.cwd(), 'server/utils/ai/articleQuality.ts'), 'utf8')

  it('reaches the writer and the verifier as testimony with a no-invention boundary', () => {
    expect(article).toContain('${AUTHOR_ACCOUNT_RULE}')
    expect(quality).toContain('${AUTHOR_ACCOUNT_VERIFICATION}')
    expect(quality).toContain('never invent names of people, officials or companies, amounts, exact dates')
  })
})
