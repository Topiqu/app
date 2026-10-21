<template>
  <div class="mx-auto w-full max-w-md space-y-4 px-4 py-8">
    <h1 class="text-xl font-semibold text-highlighted">{{ $t('common.auth.transfer.title') }}</h1>
    <UProgress v-if="status === 'pending'" :aria-label="$t('common.loading')" />
    <UAlert
      v-else-if="error || failed"
      color="error"
      :title="$t('common.auth.transfer.failed')"
      :description="$t('common.auth.transfer.restart')"
    />
    <template v-else-if="data">
      <p class="break-all text-muted">{{ $t('common.auth.transfer.target', { host: data.host }) }}</p>
      <p class="text-sm text-muted">{{ $t('common.auth.transfer.explanation') }}</p>
      <AuthForm v-if="!session?.user" :redirectTo="route.fullPath" />
      <template v-else>
        <UButton block :loading="busy" @click="authorize"
          ><span class="truncate">{{ $t('common.auth.transfer.confirm', { name: session.user.name }) }}</span></UButton
        >
        <UButton
          block
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="signOut({ callbackUrl: route.fullPath })"
          >{{ $t('common.auth.transfer.switchAccount') }}</UButton
        >
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ shell: 'product', dashboardSidebar: false })
const route = useRoute()
const { data: session, signOut } = useAuth()
const busy = shallowRef(false)
const failed = shallowRef(false)
const { data, status, error } = await useFetch('/api/auth/transfer/request', {
  query: { request: route.query.request },
})
const authorize = async () => {
  busy.value = true
  try {
    const result = await $fetch('/api/auth/transfer/authorize', {
      method: 'POST',
      body: { request: route.query.request },
    })
    await navigateTo(result.url, { external: true })
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>
