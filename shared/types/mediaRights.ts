export const MEDIA_ORIGINS = [
  'UNKNOWN',
  'OWN',
  'TOPIQU_AI',
  'EXTERNAL_AI',
  'LICENSED_STOCK',
  'CREATIVE_COMMONS',
  'PUBLIC_DOMAIN',
  'EXTERNAL',
  'OTHER',
] as const

export type MediaOrigin = (typeof MEDIA_ORIGINS)[number]
export type MediaRightsIssueCode =
  | 'missing-origin'
  | 'permission-unconfirmed'
  | 'missing-source'
  | 'missing-license'
  | 'missing-author'
  | 'missing-attribution'
  | 'hotlinked'
  | 'duplicate-media'
  | 'unsafe-url'
  | 'copyright-metadata'

export interface MediaAssetRecord {
  id: string
  url: string
  deliveryUrl?: string | null
  name?: string | null
  defaultAltText?: string | null
  origin: MediaOrigin
  sourceUrl?: string | null
  author?: string | null
  license?: string | null
  licenseUrl?: string | null
  attribution?: string | null
  attributionRequired: boolean
  rightsConfirmedAt?: string | Date | null
  rightsConfirmedById?: string | null
  originalFilename?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  contentHash?: string | null
  metadataSignals?: unknown
  machineTags?: string[]
  createdAt?: string | Date
  archivedAt?: string | Date | null
}

export interface ArticleMediaInput {
  imageUrl?: string | null
  coverMediaId?: string | null
  content?: string | null
}

export interface ArticleMediaOccurrence {
  key: string
  placement: 'cover' | 'body'
  url: string
  alt?: string
  mediaId?: string
  blockIndex?: number
}

export interface MediaRightsIssue {
  code: MediaRightsIssueCode
  severity: 'warning' | 'info'
}

export interface MediaRightsItem extends ArticleMediaOccurrence {
  asset: MediaAssetRecord | null
  issues: MediaRightsIssue[]
  state: 'recorded' | 'needs-attention'
}

export interface MediaRightsReport {
  fingerprint: string
  items: MediaRightsItem[]
  counts: { total: number; recorded: number; needsAttention: number }
}

export interface MediaRightsReview {
  fingerprint: string
  acknowledged: true
}
