/** Add destinations here to expose their tenant switches consistently in settings. */
export const PUBLICATION_CHANNELS = [
  { key: 'web', field: 'publishToWeb', icon: 'mdi:web' },
  { key: 'shopify', field: 'publishToShopify', icon: 'mdi:shopify' },
  { key: 'linkedin', field: 'publishToLinkedIn', icon: 'mdi:linkedin' },
] as const

export type PublicationChannelSettings = Record<(typeof PUBLICATION_CHANNELS)[number]['field'], boolean>

export const publicationChannelSettings = (
  site?: Partial<PublicationChannelSettings> | null,
): PublicationChannelSettings =>
  Object.fromEntries(
    PUBLICATION_CHANNELS.map(({ field }) => [field, site?.[field] ?? true]),
  ) as PublicationChannelSettings
