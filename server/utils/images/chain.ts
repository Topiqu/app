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
    const image = await provider.search(query.trim())
    if (image) return image
  }

  return null
}

/** Search existing images before the caller considers an explicitly labelled AI fallback. */
export const findStockImage = async (
  intent: ImageIntent,
  query: string,
  chains = imageChains,
): Promise<{ image: StockImage; kind: ImageKind } | null> => {
  if (intent === 'photo' || intent === 'generate') {
    const documentary = await firstHit(chains.photo, query)
    if (documentary) return { image: documentary, kind: intent === 'photo' ? 'photo' : 'illustration' }
  }

  const stock = await firstHit(chains.stock, query)

  return stock ? { image: stock, kind: 'illustration' } : null
}

export const findCoverImage = (query: string) => openverse.search(query)
