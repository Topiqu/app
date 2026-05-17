<template>
  <div
    v-if="target"
    class="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-5 justify-between"
  >
    <div class="flex items-start gap-3 flex-1">
      <Icon name="mdi:rocket-launch" class="w-6 h-6 text-purple-500 shrink-0 mt-1" />
      <div class="space-y-2">
        <h4 class="font-bold text-purple-800 dark:text-purple-300 text-sm">
          {{ $t(`admin.upgrade.${target.i18nKey}.title`) }}
        </h4>
        <p class="text-sm text-purple-700 dark:text-purple-200/80">
          {{ $t(`admin.upgrade.${target.i18nKey}.description`) }}
        </p>
        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
          <li
            v-for="feature in features"
            :key="feature"
            class="flex items-start gap-2 text-xs text-purple-700 dark:text-purple-200/80"
          >
            <Icon name="mdi:check-circle" class="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
            <span>{{ feature }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="shrink-0">
      <Button
        variant="primary"
        :disabled="loading"
        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white whitespace-nowrap shadow-md"
        @click="upgrade"
      >
        <Icon v-if="!loading" name="mdi:star-four-points" class="w-4 h-4 mr-2" />
        <Icon v-else name="mdi:loading" class="w-4 h-4 mr-2 animate-spin" />
        {{ loading ? $t('admin.upgrade.loading') : $t('admin.upgrade.cta', { plan: target.plan }) }}
      </Button>
    </div>
  </div>
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
    toast.error({ message: t('admin.upgrade.error') })
    loading.value = false
  }
}
</script>
