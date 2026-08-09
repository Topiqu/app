import type { ImageKind } from '~~/shared/utils/imageCredit'

import type { ImageIntent, ImageProvider, StockImage } from './types'

import { openverse } from './openverse'
import { wikimedia } from './wikimedia'

/**
 * Ordered by what each library actually holds: Commons has the real people, places and events a
 * news piece needs. Openverse backs it up and supplies broadly reusable stock imagery.
 */
export const imageChains: Record<'photo' | 'stock', ImageProvider[]> = {
  photo: [wikimedia, openverse],
  stock: [openverse],
}

const firstHit = async (providers: ImageProvider[], query: string) => {
  for (const provider of providers) {
    const image = await provider.search(query)
    if (image) return image
  }

  return null
}

/**
 * A `photo` that finds nothing degrades to a stock picture *relabelled as an illustration* rather
 * than passing an unrelated image off as the event. The caller must not generate one either — see
 * `allowsGeneratedFallback`: a synthetic image under a documentary caption is the one failure mode
 * here that misinforms the reader instead of merely disappointing them.
 */
export const findStockImage = async (
  intent: ImageIntent,
  query: string,
  chains = imageChains,
): Promise<{ image: StockImage; kind: ImageKind } | null> => {
  if (intent === 'generate') return null

  if (intent === 'photo') {
    const documentary = await firstHit(chains.photo, query)
    if (documentary) return { image: documentary, kind: 'photo' }
  }

  const stock = await firstHit(chains.stock, query)

  return stock ? { image: stock, kind: 'illustration' } : null
}

export const allowsGeneratedFallback = (intent: ImageIntent) => intent !== 'photo'

export const findCoverImage = (query: string) => openverse.search(query)
