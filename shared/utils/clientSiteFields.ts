export const PRIVILEGED_CLIENT_SITE_FIELDS = [
  'plan',
  'tokenLimit',
  'gamNetworkCode',
  'allowAds',
] as const

export const TENANT_EDITABLE_CLIENT_SITE_FIELDS = [
  'name',
  'domain',
  'generationFrequency',
  'keywords',
  'audience',
  'language',
  'theme',
  'focus',
  'description',
  'logoUrl',
  'autoRelease',
  'gtagId',
  'allowGtag',
  'aiToneOfVoice',
  'aiControversyLevel',
  'translationMode',
  'translationLanguages',
] as const

export const fieldMask = <T extends readonly string[]>(fields: T) =>
  Object.fromEntries(fields.map((field) => [field, true])) as { [K in T[number]]: true }
