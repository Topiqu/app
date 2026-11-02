import type { UiLanguage } from '~~/generated/zenstack/models'

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
    language: useCookie<UiLanguage | null>('topiqu-language', options),
    theme: useCookie<'light' | 'dark' | null>('topiqu-theme', options),
  }
}
