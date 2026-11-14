import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { ImageProvider, StockImage } from '../../../server/utils/images/types'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/images/selection'), 'matchesImageQuery', 'usableSize')
  await stubNitroImports(import('../../../server/utils/images/http'), 'fetchJson', 'imageApiHeaders')
  await stubNitroImports(import('../../../server/utils/images/openverse'), 'openverse')
  await stubNitroImports(import('../../../server/utils/images/wikimedia'), 'wikimedia')
}

await stubImports()

const { findStockImage, imageChains } = await import('../../../server/utils/images/chain')

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
    expect(imageChains.stock.map(({ name }) => name)).toEqual(['openverse', 'wikimedia'])
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

    expect(first.search).toHaveBeenCalledWith('q', undefined)
    expect(result).toMatchObject({ kind: 'photo', image: { url: 'https://openverse/x.jpg' } })
  })

  it('does not shorten a query and lose the requested installment or subject', async () => {
    const archive = provider('wikimedia', null)
    const stock = provider('openverse', null)
    const query = 'The Witcher 4 Ciri screenshot'
    expect(await findStockImage('photo', query, { photo: [archive], stock: [stock] })).toBeNull()
    expect(archive.search).toHaveBeenCalledExactlyOnceWith(query, undefined)
    expect(stock.search).toHaveBeenCalledExactlyOnceWith(query, undefined)
  })

  it('relabels a photo that only stock could answer as an illustration', async () => {
    const result = await findStockImage('photo', 'q', chains({ photo: [provider('wikimedia', null)] }))

    // The picture is real but unrelated to the event, so it must not read as a record of it.
    expect(result).toMatchObject({ kind: 'illustration', image: { url: 'https://openverse/x.jpg' } })
  })

  it('searches existing images even for a generate intent', async () => {
    const photo = provider('wikimedia', hit('wikimedia'))

    expect(await findStockImage('generate', 'q', chains({ photo: [photo] }))).toMatchObject({ kind: 'illustration' })
    expect(photo.search).toHaveBeenCalledWith('q', undefined)
  })

  it('falls back to Commons for a stock picture when Openverse finds nothing', async () => {
    const commons = provider('wikimedia', hit('wikimedia'))
    const result = await findStockImage('stock', 'sound level meter', {
      photo: [commons],
      stock: [provider('openverse', null), commons],
    })
    expect(result).toMatchObject({ kind: 'illustration', image: { url: 'https://wikimedia/x.jpg' } })
  })

  it('never asks a provider twice for one photo', async () => {
    const commons = provider('wikimedia', null)
    const openverse = provider('openverse', null)
    expect(await findStockImage('photo', 'q', { photo: [commons, openverse], stock: [openverse, commons] })).toBeNull()
    expect(commons.search).toHaveBeenCalledOnce()
    expect(openverse.search).toHaveBeenCalledOnce()
  })

  it('returns null when every provider is empty', async () => {
    const empty = { photo: [provider('wikimedia', null)], stock: [provider('openverse', null)] }

    expect(await findStockImage('stock', 'q', empty)).toBeNull()
  })
})

beforeEach(stubImports)
