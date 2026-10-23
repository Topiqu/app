// `ImageCredit`/`ImageKind` live in `shared/` because the cover renders its credit client-side.
// Not re-exported from here: two auto-import sources for one name, and unimport picks a winner.

/** What the article needs from a picture. The provider chain — not the model — decides where it comes from. */
export type ImageIntent = 'photo' | 'stock' | 'generate'

export interface StockImage {
  url: string
  /** A smaller render for the vision check, where `url` is a full-size original. */
  previewUrl?: string
  width?: number
  height?: number
  /** The library's own description of the picture. Caption fallback, never a replacement for it. */
  alt?: string
  credit: ImageCredit
}

/** Async so a caller can look at the picture itself before taking it. */
export type ImageAccept = (image: StockImage) => boolean | Promise<boolean>

export interface ImageProvider {
  name: string
  /** Returns the best candidate `accept` allows; without it, the best candidate. */
  search: (query: string, accept?: ImageAccept) => Promise<StockImage | null>
}

/** A resolved image, ready to be rendered into the body. */
export interface ArticleImage {
  url: string
  storageKey?: string
  mimeType?: string
  sizeBytes?: number
  contentHash?: string
  mediaId?: string
  kind: ImageKind
  width?: number
  height?: number
  alt?: string
  credit?: ImageCredit
}
