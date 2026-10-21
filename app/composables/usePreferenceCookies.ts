import type { Language } from '~~/generated/zenstack/models'

import { preferenceCookieDomain } from '~~/shared/utils/preferences'

export const usePreferenceCookies = () => {
  const url = useRequestURL()
  const options = {
    domain: preferenceCookieDomain(url.hostname),
    path: '/',
    sameSite: 'lax' as const,
    secure: url.protocol === 'https:',
    maxAge: 60 * 60 * 24 * 365,
  }
  return {
    language: useCookie<Language | null>('topiqu-language', options),
    theme: useCookie<'light' | 'dark' | null>('topiqu-theme', options),
  }
}
