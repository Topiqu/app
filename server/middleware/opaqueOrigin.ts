// A sandboxed widget frame is an opaque origin (`Origin: null`). It has no business writing to the API with
// a reader's cookies, whatever the browser's SameSite handling of such frames turns out to be.
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  if (getRequestHeader(event, 'origin') === 'null' && getRequestHeader(event, 'cookie'))
    throw createError({ statusCode: 403, message: 'Opaque origin' })
})
