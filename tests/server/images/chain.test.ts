import { describe, expect, it, vi } from 'vitest'

import type { ImageProvider, StockImage } from '../../../server/utils/images/types'

import { allowsGeneratedFallback, findStockImage, imageChains } from '../../../server/utils/images/chain'

const hit = (source: string): StockImage => ({ url: `https://${source}/x.jpg`, credit: { source } })

const provider = (name: string, result: StockImage | null): ImageProvider => ({
  name,
  search: vi.fn(async () => result),
})

const chains = (over: Partial<Record<'photo' | 'stock', ImageProvider[]>> = {}) => ({
  photo: [provider('wikimedia', hit('wikimedia'))],
  stock: [provider('openverse', hit('openverse'))],
  ...over,
})

describe('findStockImage', () => {
  it('uses only the keyless providers in the production chains', () => {
    expect(imageChains.photo.map(({ name }) => name)).toEqual(['wikimedia', 'openverse'])
    expect(imageChains.stock.map(({ name }) => name)).toEqual(['openverse'])
  })

  it('serves a photo intent from the documentary chain', async () => {
    const result = await findStockImage('photo', 'putin trump summit', chains())

    expect(result).toMatchObject({ kind: 'photo', image: { url: 'https://wikimedia/x.jpg' } })
  })

  it('falls through to the next provider in a chain', async () => {
    const first = provider('wikimedia', null)
    const result = await findStockImage(
      'photo',
      'q',
      chains({ photo: [first, provider('openverse', hit('openverse'))] }),
    )

    expect(first.search).toHaveBeenCalledWith('q')
    expect(result).toMatchObject({ kind: 'photo', image: { url: 'https://openverse/x.jpg' } })
  })

  it('retries a sentence-like archive query with a shorter subject query', async () => {
    const archive: ImageProvider = {
      name: 'wikimedia',
      search: vi.fn(async (query) => (query === 'The Witcher 4 Ciri protagonist Kovir' ? hit('wikimedia') : null)),
    }
    const result = await findStockImage(
      'photo',
      'The Witcher 4 Ciri protagonist Kovir technical demonstration screenshot',
      chains({ photo: [archive] }),
    )

    expect(archive.search).toHaveBeenNthCalledWith(
      1,
      'The Witcher 4 Ciri protagonist Kovir technical demonstration screenshot',
    )
    expect(archive.search).toHaveBeenNthCalledWith(2, 'The Witcher 4 Ciri protagonist Kovir')
    expect(result).toMatchObject({ kind: 'photo', image: { url: 'https://wikimedia/x.jpg' } })
  })

  it('relabels a photo that only stock could answer as an illustration', async () => {
    const result = await findStockImage('photo', 'q', chains({ photo: [provider('wikimedia', null)] }))

    // The picture is real but unrelated to the event, so it must not read as a record of it.
    expect(result).toMatchObject({ kind: 'illustration', image: { url: 'https://openverse/x.jpg' } })
  })

  it('never reaches a provider for a generate intent', async () => {
    const photo = provider('wikimedia', hit('wikimedia'))

    expect(await findStockImage('generate', 'q', chains({ photo: [photo] }))).toBeNull()
    expect(photo.search).not.toHaveBeenCalled()
  })

  it('returns null when every provider is empty', async () => {
    const empty = { photo: [provider('wikimedia', null)], stock: [provider('openverse', null)] }

    expect(await findStockImage('stock', 'q', empty)).toBeNull()
  })
})

describe('allowsGeneratedFallback', () => {
  it('refuses to synthesise a picture for a documentary intent', () => {
    expect(allowsGeneratedFallback('photo')).toBe(false)
    expect(allowsGeneratedFallback('stock')).toBe(true)
    expect(allowsGeneratedFallback('generate')).toBe(true)
  })
})
