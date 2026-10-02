import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  briefQuestions,
  enhancePrompt,
  rewriteDocumentBlocks,
  rewritePassage,
  sanitizeInlineText,
  sanitizePassage,
} from '../../../server/utils/ai/enhance'

const { generateStructuredText, generatePlainText } = vi.hoisted(() => ({
  generateStructuredText: vi.fn<(typeof import('ai'))['generateText']>(),
  generatePlainText: vi.fn<(typeof import('ai'))['generateText']>(),
}))

vi.mock('ai', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('ai')>()
  return {
    ...sdk,
    generateText: (options: Parameters<typeof sdk.generateText>[0]) =>
      options.output ? generateStructuredText(options) : generatePlainText(options),
  }
})

beforeEach(() => vi.stubGlobal('aiModel', (task: string) => task))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(generatePlainText).mockReset()
  vi.mocked(generateStructuredText).mockReset()
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
    vi.mocked(generatePlainText).mockResolvedValue({
      text: '```html\n<p>Short <strong>text</strong><iframe src="x"></iframe></p>\n```',
      usage: { totalTokens: 5 },
    } as never)
    const { html } = await rewritePassage('<p>Long text</p>', 'shorten')
    expect(html).toBe('<p>Short <strong>text</strong></p>')
    expect(vi.mocked(generatePlainText).mock.calls[0]![0]).toMatchObject({ model: 'textEdit' })
  })

  it('offers a general improvement preset for a selected passage', async () => {
    vi.mocked(generatePlainText).mockResolvedValue({ text: '<p>Clearer text</p>', usage: {} } as never)
    expect((await rewritePassage('<p>Awkward text</p>', 'improve', 'Make the wording clearer')).html).toBe(
      '<p>Clearer text</p>',
    )
    expect(vi.mocked(generatePlainText).mock.calls[0]![0].prompt).toBe(
      JSON.stringify({ instruction: 'Make the wording clearer', html: '<p>Awkward text</p>' }),
    )
    expect(String(vi.mocked(generatePlainText).mock.calls[0]![0].instructions)).toContain('instruction field')
  })

  it('rewrites document blocks in order while sanitizing markup and preserving links', async () => {
    vi.mocked(generateStructuredText).mockResolvedValue({
      output: {
        blocks: ['Clear <strong>opening</strong>', 'Read <a href="https://example.test" onclick="x()">more</a>'],
      },
      usage: { totalTokens: 12 },
    } as never)
    const input = ['Clumsy opening', 'See <a href="https://example.test">more</a>']
    expect((await rewriteDocumentBlocks(input, 'Make the article clearer')).blocks).toEqual([
      'Clear <strong>opening</strong>',
      'Read <a href="https://example.test">more</a>',
    ])
    expect(vi.mocked(generateStructuredText).mock.calls[0]![0]).toMatchObject({
      model: 'textEdit',
      prompt: JSON.stringify({ instruction: 'Make the article clearer', blocks: input }),
    })
  })

  it('rejects a document rewrite that drops an existing link', async () => {
    vi.mocked(generateStructuredText).mockResolvedValue({ output: { blocks: ['No link'] }, usage: {} } as never)
    await expect(rewriteDocumentBlocks(['<a href="https://example.test">Link</a>'], 'Clarify')).rejects.toThrow(
      'changed a link',
    )
  })

  it('preserves safe text color but removes arbitrary model CSS', () => {
    expect(sanitizeInlineText('<span style="color: #ff0000; background-image: url(https://bad.test)">Red</span>')).toBe(
      '<span style="color: #ff0000">Red</span>',
    )
    expect(sanitizeInlineText('<span style="background-image: url(https://bad.test)">Text</span>')).toBe(
      '<span>Text</span>',
    )
  })

  it('rejects a document rewrite that drops inline text color', async () => {
    vi.mocked(generateStructuredText).mockResolvedValue({ output: { blocks: ['Plain'] }, usage: {} } as never)
    await expect(rewriteDocumentBlocks(['<span style="color: #ff0000">Colored</span>'], 'Clarify')).rejects.toThrow(
      'changed inline styling',
    )
  })

  it('uses the preset instruction for a brief edit', async () => {
    vi.mocked(generatePlainText).mockResolvedValue({ text: ' Fixed brief ', usage: {} } as never)
    expect((await enhancePrompt('brief', 'grammar')).text).toBe('Fixed brief')
    expect(String(vi.mocked(generatePlainText).mock.calls[0]![0].instructions)).toContain('Fix spelling, grammar')
  })

  it('asks questions instead of inventing the author’s facts', async () => {
    vi.mocked(generateStructuredText).mockResolvedValue({
      output: { questions: ['When did you start?'] },
      usage: {},
    } as never)
    expect((await briefQuestions('We built a house', 'story')).questions).toEqual(['When did you start?'])
    expect(String(vi.mocked(generateStructuredText).mock.calls[0]![0].instructions)).toContain(
      'web research cannot answer',
    )
  })
})

describe('author first-hand account', () => {
  const article = readFileSync(resolve(process.cwd(), 'server/utils/ai/articleConfig.ts'), 'utf8')
  const quality = readFileSync(resolve(process.cwd(), 'server/utils/ai/articleQuality.ts'), 'utf8')

  it('reaches the writer and the verifier as testimony with a no-invention boundary', () => {
    expect(article).toContain('${AUTHOR_ACCOUNT_RULE}')
    expect(quality).toContain('${AUTHOR_ACCOUNT_VERIFICATION}')
    expect(quality).toContain('never invent names of people, officials or companies, amounts, exact dates')
  })
})
