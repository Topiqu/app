<template>
  <div class="flex items-center justify-center min-h-screen bg-white dark:bg-[#0A0A0A]">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <form
      v-if="csrfToken && provider"
      ref="auth-form"
      :action="`/api/auth/signin/${provider}`"
      method="POST"
      class="hidden"
    >
      <input type="hidden" name="csrfToken" :value="csrfToken" />
      <input type="hidden" name="callbackUrl" :value="callbackUrl" />
    </form>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const csrfToken = shallowRef<string>('')
const provider = shallowRef<string>('')
const callbackUrl = shallowRef<string>('')

const formRef = useTemplateRef<HTMLFormElement>('auth-form')

onMounted(async () => {
  provider.value = (route.query.provider as string) || ''
  callbackUrl.value = (route.query.callbackUrl as string) || '/'

  if (provider.value) {
    try {
      const res = await $fetch<{ csrfToken: string }>('/api/auth/csrf')

      if (res && res.csrfToken) {
        csrfToken.value = res.csrfToken

        await nextTick()

        if (formRef.value) {
          formRef.value.submit()
        } else {
          window.location.href = '/'
        }
      } else {
        window.location.href = '/'
      }
    } catch (e) {
      console.error('Failed to init OAuth flow', e)
      window.location.href = '/'
    }
  } else {
    navigateTo('/')
  }
})
</script>
