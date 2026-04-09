<template>
  <div class="flex items-center justify-center min-h-screen bg-white dark:bg-[#0A0A0A]">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

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
