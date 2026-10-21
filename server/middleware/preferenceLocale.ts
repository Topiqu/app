import { isPreferenceLanguage } from '~~/shared/utils/preferences'

/** Only an unlocalized entry uses the account/shared preference. Explicit links are authoritative. */
export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname !== '/' || !['GET', 'HEAD'].includes(event.method)) return
  const user = await getSessionUser(event)
  const language = user?.language ?? getCookie(event, 'topiqu-language')
  if (!isPreferenceLanguage(language)) return
  const url = getRequestURL(event)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  appendResponseHeader(event, 'vary', 'Cookie')
  return sendRedirect(event, `/${language}${url.search}`, 302)
})
