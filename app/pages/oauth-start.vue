<template>
  <div class="flex items-center justify-center min-h-screen bg-white dark:bg-[#0A0A0A]">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { signIn } = useAuth()

onMounted(async () => {
  const provider = route.query.provider as string
  const callbackUrl = route.query.callbackUrl as string

  if (provider) {
    try {
      const result = await signIn(provider, { callbackUrl, redirect: false })

      if (result?.url) {
        window.location.href = result.url
      } else {
        window.location.href = '/'
      }
    } catch (e) {
      console.error('OAuth redirect failed', e)
      window.location.href = '/'
    }
  } else {
    navigateTo('/')
  }
})
</script>
