import { describe, expect, it } from 'vitest'

import { pickOpenverseImage } from '../../../server/utils/images/openverse'
import { createImageSelection, matchesImageQuery } from '../../../server/utils/images/selection'

describe('article image relevance and uniqueness', () => {
  it('rejects the production keychain photograph as an illustration of the game', () => {
    expect(matchesImageQuery('The Witcher Keychain', 'The Witcher')).toBe(false)
    expect(matchesImageQuery('The Witcher Keychain', 'The Witcher keychain')).toBe(true)
  })
  it('rejects a different installment, unrelated scenery and missing metadata', () => {
    for (const title of [
      'The Witcher 3 Ciri',
      'The Witcher 4 Ciri cosplay',
      'The Witcher 4 Ciri fan art',
      'Forest landscape',
      undefined,
    ]) {
      expect(matchesImageQuery(title, 'The Witcher 4 Ciri screenshot')).toBe(false)
    }
    expect(matchesImageQuery('Ciri in The Witcher 4', 'The Witcher 4 Ciri screenshot')).toBe(true)
  })

  it('filters relevance before preferring landscape images', () => {
    expect(
      pickOpenverseImage(
        [
          { title: 'Forest', url: 'https://images.test/forest', width: 1600, height: 900 },
          { title: 'The Witcher 4 Ciri', url: 'https://images.test/ciri', width: 900, height: 1600 },
        ],
        'Witcher 4 Ciri',
      )?.url,
    ).toBe('https://images.test/ciri')
    expect(pickOpenverseImage([{ title: 'Witcher 3', url: 'https://images.test/old' }], 'Witcher 4')).toBeNull()
  })

  it('rejects cover reuse, resized copies, and different URLs with the same source page', () => {
    const accept = createImageSelection()
    expect(
      accept({
        url: 'https://images.test/ciri?w=1200',
        credit: { source: 'archive', sourceUrl: 'https://archive.test/ciri' },
      }),
    ).toBe(true)
    expect(accept({ url: 'https://images.test/ciri?w=600' })).toBe(false)
    expect(
      accept({
        url: 'https://other.test/ciri.jpg',
        credit: { source: 'archive', sourceUrl: 'https://archive.test/ciri' },
      }),
    ).toBe(false)
    expect(accept({ url: 'https://images.test/kovir' })).toBe(true)
  })
})
