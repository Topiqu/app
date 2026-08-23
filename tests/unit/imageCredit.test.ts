import { describe, expect, it } from 'vitest'

import { creditHref, creditSegments, creditSeparator } from '../../shared/utils/imageCredit'

describe('creditHref', () => {
  it('passes http(s) through', () => {
    expect(creditHref('https://commons.wikimedia.org/wiki/File:X')).toBe('https://commons.wikimedia.org/wiki/File:X')
    expect(creditHref('http://example.com')).toBe('http://example.com')
  })

  // `Article.imageCredit` round-trips through the admin form and `POST /api/articles` spreads the
  // body straight into `create`, so these are editable input rendered on a public page.
  it('refuses any other scheme, and anything unparseable', () => {
    expect(creditHref('javascript:alert(1)')).toBeUndefined()
    expect(creditHref('data:text/html,<script>')).toBeUndefined()
    expect(creditHref('/relative/path')).toBeUndefined()
    expect(creditHref('')).toBeUndefined()
    expect(creditHref(undefined)).toBeUndefined()
  })
})

describe('creditSegments', () => {
  it('orders author, license, then the library', () => {
    const segments = creditSegments(
      {
        author: 'Kremlin.ru',
        authorUrl: 'https://kremlin.ru',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
        source: 'Wikimedia Commons',
      },
      'foto: {author}',
    )

    expect(segments).toEqual([
      // The label stays out of the anchor — only the name itself is the link.
      { before: 'foto: ', text: 'Kremlin.ru', after: '', href: 'https://kremlin.ru' },
      { text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0' },
      { text: 'Wikimedia Commons', href: undefined },
    ])
  })

  it('keeps a label that follows the name', () => {
    const [author] = creditSegments({ author: 'Jan', source: 'Openverse' }, '{author} (foto)')

    expect(author).toMatchObject({ before: '', text: 'Jan', after: ' (foto)' })
  })

  it('drops an unsafe author link but keeps the name', () => {
    const [author] = creditSegments({ author: 'X', authorUrl: 'javascript:alert(1)', source: 'Openverse' }, '{author}')

    expect(author).toMatchObject({ text: 'X', href: undefined })
  })

  it('always ends with the library, even alone', () => {
    expect(creditSegments({ source: 'Openverse' }, 'foto: {author}')).toEqual([{ text: 'Openverse', href: undefined }])
  })
})

describe('creditSeparator', () => {
  it('commas between the attribution parts and a slash before the library', () => {
    expect([0, 1, 2].map((i) => creditSeparator(i, 3))).toEqual(['', ', ', ' / '])
    expect(creditSeparator(0, 1)).toBe('')
  })
})
