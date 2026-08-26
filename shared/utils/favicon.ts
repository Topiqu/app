export const FAVICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
// Decimal kB, so the number in the constraint badge and in every rejection message is literally "512 kB".
export const FAVICON_MAX_BYTES = 512_000
export const FAVICON_MIN_SIZE = 32
export const FAVICON_MAX_SIZE = 512

export const isFaviconMimeType = (mimeType: string) => (FAVICON_MIME_TYPES as readonly string[]).includes(mimeType)
