import { describe, expect, it } from 'vitest'

import { creditHref, creditSegments } from '../../shared/utils/imageCredit'

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
  const credit = {
    author: 'Kremlin.ru',
    authorUrl: 'https://kremlin.ru',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    source: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
  }

  it('links the name to the work, then the license in brackets', () => {
    expect(creditSegments(credit, 'Foto: {author}')).toEqual([
      // The label stays out of the anchor — only the name itself is the link.
      { before: 'Foto: ', text: 'Kremlin.ru', after: '', href: 'https://commons.wikimedia.org/wiki/File:X.jpg' },
      { before: ' (', text: 'CC BY 4.0', after: ')', href: 'https://creativecommons.org/licenses/by/4.0' },
    ])
  })

  it("falls back to the author's page when the work has none", () => {
    const [name] = creditSegments({ ...credit, sourceUrl: undefined }, 'Foto: {author}')

    expect(name).toMatchObject({ text: 'Kremlin.ru', href: 'https://kremlin.ru' })
  })

  it('keeps a label that follows the name', () => {
    const [name] = creditSegments({ author: 'Jan', source: 'Openverse' }, '{author} (foto)')

    expect(name).toMatchObject({ before: '', text: 'Jan', after: ' (foto)' })
  })

  it('drops an unsafe link but keeps the name', () => {
    const [name] = creditSegments({ author: 'X', authorUrl: 'javascript:alert(1)', source: 'Openverse' }, '{author}')

    expect(name).toMatchObject({ text: 'X', href: undefined })
  })

  it('names the library when the author is unknown', () => {
    expect(creditSegments({ source: 'Openverse' }, 'Foto: {author}')).toEqual([
      { before: 'Foto: ', text: 'Openverse', after: '', href: undefined },
    ])
  })
})
