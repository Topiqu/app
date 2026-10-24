export interface AuthSession {
  user: SessionUser
  session: { id: string; expiresAt: string }
}

const fetchSession = async (): Promise<AuthSession | null> => {
  if (import.meta.client)
    return $fetch<AuthSession | null, '/api/auth/**:all'>('/api/auth/get-session' as '/api/auth/**:all')

  // Read both before the await: the Nuxt context is gone once it resumes.
  const headers = useRequestHeaders(['cookie', 'host', 'x-forwarded-host', 'x-forwarded-proto'])
  const res = useRequestEvent()?.node.res
  // Better Auth extends an aging session by re-issuing its cookie; pass that on to the browser.
  const response = await $fetch.raw<AuthSession | null, '/api/auth/**:all'>(
    '/api/auth/get-session' as '/api/auth/**:all',
    { headers },
  )
  for (const cookie of response.headers.getSetCookie()) res?.appendHeader('set-cookie', cookie)
  return response._data ?? null
}

/** Session state shared by the app; `undefined` until the auth plugin has fetched it. */
export const useAuth = () => {
  const data = useState<AuthSession | null | undefined>('auth', () => undefined)
  const sessionRequest = useState('auth-session-request', () => 0)
  const status = computed(() =>
    data.value === undefined ? 'loading' : data.value ? 'authenticated' : 'unauthenticated',
  )

  const getSession = async ({ throwOnError = false }: { throwOnError?: boolean } = {}) => {
    const version = ++sessionRequest.value
    const initial = data.value
    const current = () => sessionRequest.value === version && data.value === initial
    try {
      const session = await fetchSession()
      if (current()) data.value = session
    } catch (error: unknown) {
      if (!current()) return data.value ?? null
      const status =
        (error as { statusCode?: number; response?: { status?: number } })?.statusCode ??
        (error as { response?: { status?: number } })?.response?.status
      if (status === 401) data.value = null
      else {
        if (data.value === undefined) data.value = null
        if (throwOnError) throw error
      }
    }
    return data.value ?? null
  }

  // A full reload drops every store that still holds the signed-out user's data.
  const signOut = async ({ callbackUrl = useRequestURL().href }: { callbackUrl?: string } = {}) => {
    await $fetch<unknown, '/api/auth/**:all'>('/api/auth/sign-out' as '/api/auth/**:all', { method: 'POST', body: {} })
    data.value = null
    await navigateTo(callbackUrl, { external: true })
  }

  return { data, status, getSession, refresh: getSession, signOut }
}
