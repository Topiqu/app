import type { UiLanguage } from '~~/generated/zenstack/models'

import { isUiLanguage } from './language'
import { isManagedDomain } from './domain'

export const preferenceCookieDomain = (hostname: string) =>
  isManagedDomain(hostname, 'topiqu.com') ? '.topiqu.com' : undefined
export const isPreferenceLanguage = (value: unknown): value is UiLanguage => isUiLanguage(value)
export const isPreferenceTheme = (value: unknown): value is 'light' | 'dark' => value === 'light' || value === 'dark'
