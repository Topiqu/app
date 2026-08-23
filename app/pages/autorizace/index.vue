<template>
  <div class="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <AuthForm :mode="initialMode" :redirectTo="invitationRedirect" />
    </div>
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'auth', shell: 'product', dashboardSidebar: false })

const route = useRoute()
const localePath = useLocalePath()
const toast = useToast()
const { signIn, getSession, data } = useAuth()

const initialMode = computed(() => (route.query.mode === 'register' ? 'register' : 'login'))
const invitationRedirect = computed(() =>
  typeof route.query.invitation === 'string'
    ? localePath({ name: 'invitation-token', params: { token: route.query.invitation } })
    : undefined,
)

if (route.query.redirect?.length) navigateTo(route.query.redirect.toString(), { external: true })

const finishOnboardingLogin = async (token: string) => {
  try {
    const result = await signIn('credentials', { loginToken: token, redirect: false })
    if (result?.error) throw new Error(result.error)

    await getSession()
    const role = data.value?.user?.role
    toast.add({ color: 'success', title: $t('common.auth.loginSuccess') })

    if (role === 'superadmin') return navigateTo(localePath({ name: 'master' }))
    if (role === 'admin') return navigateTo(localePath({ name: 'admin' }))
    return navigateTo(localePath({ name: 'uzivatel' }))
  } catch {
    toast.add({ color: 'error', title: $t('common.auth.onboardingLoginExpired') })
    navigateTo({ query: {} })
  }
}

onMounted(() => {
  if (route.query.created === 'true' && typeof route.query.token === 'string') {
    finishOnboardingLogin(route.query.token)
  }
})
</script>
