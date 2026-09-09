import { authErrorRedirect } from '../../shared/utils/authError'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, authErrorRedirect(getQuery(event).error, getCookie(event, 'i18n_lang')))
})
