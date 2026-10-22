<template>
  <div class="flex min-h-0 flex-1 items-center justify-center bg-default py-8">
    <UProgress class="w-48" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  shell: 'product',
  dashboardSidebar: false,
})

const route = useRoute()

if (!route.query.provider) {
  const locale = route.path.split('/').filter(Boolean)[0] || 'en'
  await navigateTo(`/${locale}`)
}

onMounted(async () => {
  const provider = (route.query.provider as string) || ''
  const callbackUrl = (route.query.callbackUrl as string) || '/'

  if (!provider) return navigateTo('/')

  try {
    // Better Auth rejects a callbackURL outside `trustedOrigins`, so a foreign return address fails here.
    const { url } = await $fetch<{ url: string }, '/api/auth/**:all'>(
      '/api/auth/sign-in/social' as '/api/auth/**:all',
      {
        method: 'POST',
        body: { provider, callbackURL: callbackUrl },
      },
    )
    window.location.replace(url)
  } catch {
    window.location.replace('/')
  }
})
</script>
