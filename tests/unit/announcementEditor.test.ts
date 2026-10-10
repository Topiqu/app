import { describe, expect, it } from 'vitest'

import { announcementDocument, announcementRuns } from '../../app/utils/announcementEditor'

describe('announcement editor content', () => {
  it('preserves emphasis, relative links and line breaks across reopening', () => {
    const runs = [
      { text: 'Autumn sale\n', bold: true, italic: false, url: null },
      { text: 'Read more', bold: false, italic: true, url: '/en' },
    ]
    const reopened = announcementRuns(announcementDocument('', runs))
    expect(reopened.map((run) => run.text).join('')).toBe('Autumn sale\nRead more')
    expect(reopened.find((run) => run.text === 'Autumn sale')).toMatchObject({ bold: true })
    expect(reopened.at(-1)).toEqual(runs[1])
  })

  it('does not turn legacy plain text that looks like HTML into markup', () => {
    const text = '<script>alert(1)</script>'
    expect(announcementRuns(announcementDocument(text))).toEqual([{ text, bold: false, italic: false, url: null }])
  })

  it('drops unsafe pasted links while retaining their text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Read more', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
      ],
    }
    expect(announcementRuns(doc)).toEqual([{ text: 'Read more', bold: false, italic: false, url: null }])
  })
})
