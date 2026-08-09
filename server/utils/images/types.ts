// `ImageCredit`/`ImageKind` live in `shared/` because the cover renders its credit client-side.
// Not re-exported from here: two auto-import sources for one name, and unimport picks a winner.
import type { ImageCredit, ImageKind } from '~~/shared/utils/imageCredit'

/** What the article needs from a picture. The provider chain — not the model — decides where it comes from. */
export type ImageIntent = 'photo' | 'stock' | 'generate'

export interface StockImage {
  url: string
  /** The library's own description of the picture. Caption fallback, never a replacement for it. */
  alt?: string
  credit: ImageCredit
}

export interface ImageProvider {
  name: string
  search: (query: string) => Promise<StockImage | null>
}

/** A resolved image, ready to be rendered into the body. */
export interface ArticleImage {
  url: string
  kind: ImageKind
  alt?: string
  credit?: ImageCredit
}
