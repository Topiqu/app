import type { MediaOrigin } from './mediaRights'

export interface MediaLibraryAsset {
  id: string
  url: string
  deliveryUrl?: string | null
  name?: string | null
  defaultAltText?: string | null
  originalFilename?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  origin: MediaOrigin
  sourceUrl?: string | null
  author?: string | null
  license?: string | null
  licenseUrl?: string | null
  attribution?: string | null
  attributionRequired: boolean
  rightsConfirmedAt?: string | Date | null
  machineTags: string[]
  createdAt: string | Date
  archivedAt?: string | Date | null
  purgeAfter?: string | Date | null
  usageCount: number
}

export interface MediaLibraryUsage {
  articleId: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  language: 'cs' | 'en'
  placements: Array<'COVER' | 'BODY'>
  occurrenceCount: number
}

export interface MediaLibraryPage {
  items: MediaLibraryAsset[]
  page: number
  pageSize: number
  total: number
}

export interface MediaLibraryDetail {
  asset: MediaLibraryAsset
  usages: MediaLibraryUsage[]
}

export type MediaPickerSelection = Pick<
  MediaLibraryAsset,
  'id' | 'url' | 'deliveryUrl' | 'name' | 'defaultAltText' | 'width' | 'height' | 'origin'
>
