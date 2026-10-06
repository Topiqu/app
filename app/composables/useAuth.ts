import type { SessionUser } from '~~/shared/types/auth'

export interface AuthSession {
  user: SessionUser
  session: { id: string; expiresAt: string }
}

const fetchSession = async (): Promise<AuthSession | null> => {
  if (import.meta.client) return $fetch<AuthSession | null>('/api/auth/get-session')

  // Read both before the await: the Nuxt context is gone once it resumes.
  const headers = useRequestHeaders(['cookie'])
  const res = useRequestEvent()?.node.res
  // Better Auth extends an aging session by re-issuing its cookie; pass that on to the browser.
  const response = await $fetch.raw<AuthSession | null>('/api/auth/get-session', { headers })
  for (const cookie of response.headers.getSetCookie()) res?.appendHeader('set-cookie', cookie)
  return response._data ?? null
}

/** Session state shared by the app; `undefined` until the auth plugin has fetched it. */
export const useAuth = () => {
  const data = useState<AuthSession | null | undefined>('auth', () => undefined)
  const status = computed(() =>
    data.value === undefined ? 'loading' : data.value ? 'authenticated' : 'unauthenticated',
  )

  const getSession = async () => (data.value = await fetchSession().catch(() => null))

  // A full reload drops every store that still holds the signed-out user's data.
  const signOut = async ({ callbackUrl = useRequestURL().href }: { callbackUrl?: string } = {}) => {
    await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
    data.value = null
    await navigateTo(callbackUrl, { external: true })
  }

  return { data, status, getSession, refresh: getSession, signOut }
}
