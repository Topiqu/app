<template>
  <div class="flex min-h-[100dvh] items-center justify-center bg-default">
    <UProgress class="w-48" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  shell: 'product',
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
    const res = await $fetch<{ csrfToken: string }>('/api/auth/csrf')
    if (!res?.csrfToken) return window.location.replace('/')

    const signinRes = await $fetch<{ url?: string }>(`/api/auth/signin/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken: res.csrfToken,
        callbackUrl,
        json: 'true',
      }).toString(),
    })

    if (signinRes?.url) {
      window.location.replace(signinRes.url)
    } else {
      window.location.replace('/')
    }
  } catch {
    window.location.replace('/')
  }
})
</script>
