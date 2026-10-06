import { toWebRequest } from 'h3'

// Better Auth also ships /update-user, /change-email, /delete-user, /link-social and more; each would bypass
// our own validation (username, email, ownership), so only the flows the app uses are reachable.
const routes = new Set([
  'get-session',
  'sign-out',
  'sign-in/social',
  'sign-in/credentials',
  'sign-in/token',
  'callback/google',
  'callback/github',
])

export default defineEventHandler((event) => {
  if (!routes.has(getRouterParam(event, 'all') ?? '')) throw createError({ statusCode: 404 })
  return auth.handler(toWebRequest(event))
})
