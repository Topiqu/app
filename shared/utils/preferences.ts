import type { Language } from '~~/generated/zenstack/models'

import { isManagedDomain } from './domain'

export const preferenceCookieDomain = (hostname: string) =>
  isManagedDomain(hostname, 'topiqu.com') ? '.topiqu.com' : undefined
export const isPreferenceLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && ['cs', 'en', 'de', 'fr'].includes(value)
export const isPreferenceTheme = (value: unknown): value is 'light' | 'dark' => value === 'light' || value === 'dark'
