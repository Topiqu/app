<template>
  <div class="mx-auto w-full max-w-md space-y-4 px-4 py-8">
    <h1 class="text-xl font-semibold text-highlighted">{{ $t('admin.integrationsConnection.title') }}</h1>
    <UProgress v-if="status === 'pending'" :aria-label="$t('common.loading')" />
    <UAlert
      v-else-if="error || failed"
      color="error"
      :title="$t('admin.integrationsConnection.failed')"
      :description="$t('admin.integrationsConnection.restart')"
    />
    <template v-else-if="data">
      <p class="break-words text-muted">
        {{ $t('admin.integrationsConnection.target', { provider: providerLabel, host: data.host }) }}
      </p>
      <p class="text-sm text-muted">{{ $t('admin.integrationsConnection.explanation') }}</p>
      <AuthForm v-if="!session?.user" :redirectTo="route.fullPath" />
      <template v-else>
        <UAlert v-if="!data.accountMatches" color="warning" :title="$t('admin.integrationsConnection.wrongAccount')" />
        <UButton v-else block :loading="busy" @click="authorize()">
          {{ $t('admin.integrationsConnection.confirm', { name: session.user.name }) }}
        </UButton>
        <UButton
          block
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="signOut({ callbackUrl: route.fullPath })"
        >
          {{ $t('common.auth.transfer.switchAccount') }}
        </UButton>
      </template>
      <UButton block color="neutral" variant="outline" :disabled="busy" @click="authorize(true)">
        {{ $t('common.actions.cancel') }}
      </UButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack'

definePageMeta({ shell: 'product', dashboardSidebar: false })
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
useResponseHeader('cache-control').value = 'no-store'
useResponseHeader('referrer-policy').value = 'no-referrer'
const route = useRoute()
const { data: session, signOut } = useAuth()
const busy = shallowRef(false)
const failed = shallowRef(false)
const { data, status, error, refresh } = await useFetch('/api/integrations/request', {
  query: { request: route.query.request },
})
const providerLabel = computed(() => (data.value?.provider === 'linkedin' ? 'LinkedIn' : 'Google Search Console'))
watch(
  () => session.value?.user?.id,
  () => refresh(),
)
const authorize = async (cancel = false) => {
  busy.value = true
  try {
    const result = await $fetch<InternalApi['/api/integrations/authorize']['post'], '/api/integrations/authorize'>(
      '/api/integrations/authorize',
      {
        method: 'POST',
        body: { request: route.query.request, cancel },
      },
    )
    await navigateTo(result.url, { external: true })
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>
