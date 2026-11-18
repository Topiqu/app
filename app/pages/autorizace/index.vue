<template>
  <div class="flex min-h-0 flex-1 items-center justify-center px-4 py-8 [@media(max-height:42rem)]:items-start">
    <div class="w-full max-w-md">
      <UAlert
        v-if="errorKey || handoffFailed"
        role="alert"
        color="error"
        variant="soft"
        icon="mdi:alert-circle-outline"
        :title="$t('common.auth.signInFailedTitle')"
        :description="$t(errorKey || 'common.auth.onboardingLoginExpired')"
        class="mb-4"
      />
      <div v-if="handoffPending" role="status" aria-live="polite" class="space-y-4 text-center">
        <UIcon name="mdi:loading" class="size-6 animate-spin motion-reduce:animate-none" />
        <p>{{ $t('common.auth.finishingRegistration') }}</p>
      </div>
      <AuthForm v-else :mode="initialMode" :redirectTo="invitationRedirect || appRedirect" />
    </div>
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'auth', shell: 'product', dashboardSidebar: false })

const route = useRoute()
const errorKey = computed(() => authErrorKey(route.query.error))
const localePath = useLocalePath()
const agencyIntent = useAgencyIntent()
const intent = agencyIntentFromQuery(route.query)
agencyIntent.value = intent
const appRedirect = intent
  ? localePath({ name: 'start', query: AGENCY_START_QUERY })
  : useRequestURL().hostname.replace(/^www\./, '') === 'app.topiqu.com'
    ? localePath({ name: 'start' })
    : undefined
const toast = useToast()
const handoffToken =
  route.query.created === 'true' && typeof route.query.token === 'string' && route.query.token
    ? route.query.token
    : null
const handoffPending = shallowRef(Boolean(handoffToken))
const handoffFailed = shallowRef(route.query.created === 'true' && !handoffToken)

const initialMode = computed(() => (route.query.mode === 'register' ? 'register' : 'login'))
const invitationRedirect = computed(() =>
  typeof route.query.invitation === 'string'
    ? localePath({ name: 'invitation-token', params: { token: route.query.invitation } })
    : undefined,
)

if (route.query.created !== 'true' && route.query.redirect?.length)
  navigateTo(route.query.redirect.toString(), { external: true })

const finishOnboardingLogin = async (token: string) => {
  try {
    // Removing the proof must not re-run auth middleware under the old session.
    window.history.replaceState(window.history.state, '', route.path)
    await $fetch<unknown, '/api/auth/**:all'>('/api/auth/sign-in/token' as '/api/auth/**:all', {
      method: 'POST',
      body: { token },
      retry: 0,
      timeout: 20_000,
    })
  } catch {
    toast.add({ color: 'error', title: $t('common.auth.onboardingLoginExpired') })
    handoffFailed.value = true
    handoffPending.value = false
    // A lost response can still have set the new cookie. Reload before offering manual sign-in.
    return navigateTo(localePath({ name: 'autorizace', query: { created: 'true' } }), { external: true, replace: true })
  }
  // The token endpoint set the new cookie. Resolve its workspace in a fresh app instance;
  // a failed session refresh here would otherwise leave old stores under the new identity.
  return navigateTo(appRedirect || localePath({ name: 'start' }), { external: true, replace: true })
}

onMounted(() => {
  if (handoffToken) finishOnboardingLogin(handoffToken)
})
</script>
