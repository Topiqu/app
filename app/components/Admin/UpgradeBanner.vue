<template>
  <UAlert
    v-if="target"
    color="primary"
    variant="soft"
    icon="i-mdi-rocket-launch"
    :title="$t(`admin.upgrade.${target.i18nKey}.title`)"
    :description="$t(`admin.upgrade.${target.i18nKey}.description`)"
  >
    <template #description>
      <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
        <li v-for="feature in features" :key="feature" class="flex items-start gap-2 text-xs">
          <UIcon size="14" name="i-mdi-check-circle" class="mt-0.5 shrink-0" />
          <span>{{ feature }}</span>
        </li>
      </ul>
    </template>
    <template #actions>
      <UButton
        color="primary"
        variant="solid"
        icon="i-mdi-star-four-points"
        :loading="loading"
        :disabled="loading"
        @click="upgrade"
      >
        {{ loading ? $t('admin.upgrade.loading') : $t('admin.upgrade.cta', { plan: target.plan }) }}
      </UButton>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
type SubscribablePlan = 'PRO' | 'PREMIUM'

const clientSite = await useClientSite()
const { t, tm, rt } = useI18n()
const toast = useToast()

const loading = shallowRef(false)

const target = computed<{ plan: SubscribablePlan; i18nKey: 'toPro' | 'toPremium' } | null>(() => {
  switch (clientSite?.plan) {
    case 'BASIC':
      return { plan: 'PRO', i18nKey: 'toPro' }
    case 'PRO':
      return { plan: 'PREMIUM', i18nKey: 'toPremium' }
    default:
      return null
  }
})

const features = computed<string[]>(() => {
  if (!target.value) return []
  const messages = tm(`admin.upgrade.${target.value.i18nKey}.features`) as unknown[]
  return Array.isArray(messages) ? messages.map((m) => rt(m as string)) : []
})

const upgrade = async () => {
  if (!target.value || !clientSite?.id) return
  loading.value = true
  try {
    const { url } = await $fetch<{ url: string }>('/api/stripe/subscribe', {
      method: 'POST',
      body: {
        plan: target.value.plan,
        clientSiteId: clientSite.id,
        origin: window.location.origin,
      },
    })
    if (url) window.location.href = url
  } catch {
    toast.add({ color: 'error', title: t('admin.upgrade.error') })
    loading.value = false
  }
}
</script>
