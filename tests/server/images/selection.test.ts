import { describe, expect, it } from 'vitest'

import { pickOpenverseImage } from '../../../server/utils/images/openverse'
import { createImageSelection, matchesImageQuery, photoSubjectQuery } from '../../../server/utils/images/selection'

describe('article image relevance and uniqueness', () => {
  it('can simplify a person query without dropping an installment number', () => {
    expect(photoSubjectQuery('Andrej Babis Petr Pavel 2026 meeting')).toBe('Andrej Babis')
    expect(photoSubjectQuery('The Witcher 4 Ciri screenshot')).toBeNull()
    expect(photoSubjectQuery('Czech President Petr Pavel')).toBeNull()
  })

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

describe('library image matching', () => {
  it('requires the named subject, not every word of the scene the writer described', () => {
    expect(matchesImageQuery('Andrej Babiš at a rally in 2019', 'Andrej Babis press conference 2025')).toBe(true)
    expect(matchesImageQuery('Petr Fiala speaking', 'Andrej Babis press conference')).toBe(false)
    expect(matchesImageQuery('PlayStation 5 console on a desk', 'PlayStation 5 console')).toBe(true)
    expect(matchesImageQuery('PlayStation 4 console', 'PlayStation 5 console')).toBe(false)
  })

  it('accepts a generic scene when most descriptive words match', () => {
    expect(matchesImageQuery('Business people in an office meeting room', 'Office meeting')).toBe(true)
    expect(matchesImageQuery('Gaming setup with RGB lights', 'gaming setup at night')).toBe(true)
    expect(matchesImageQuery('Mountain lake', 'gaming setup at night')).toBe(false)
    expect(matchesImageQuery('DSC_0012', 'office meeting')).toBe(false)
  })
})
