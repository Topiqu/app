<template>
  <!-- `dismissed` lives in localStorage, so the server cannot know whether this renders. -->
  <ClientOnly>
    <div
      v-if="target"
      class="relative bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-5 pr-12 flex flex-col lg:flex-row lg:items-center gap-5 justify-between"
    >
      <button
        type="button"
        :aria-label="$t('common.close')"
        class="absolute top-3 right-3 p-1 rounded-md text-purple-400 hover:text-purple-700 hover:bg-purple-500/10 dark:hover:text-purple-200 transition-colors"
        @click="dismiss"
      >
        <Icon name="mdi:close" class="w-4 h-4" />
      </button>

      <div class="flex items-start gap-3 flex-1">
        <Icon name="mdi:rocket-launch" class="w-6 h-6 text-purple-500 shrink-0 mt-1" />
        <div class="space-y-2">
          <h4 class="font-bold text-purple-800 dark:text-purple-300 text-sm">
            {{ $t(`admin.upgrade.${i18nKey}.title`) }}
          </h4>
          <p class="text-sm text-purple-700 dark:text-purple-200/80">
            {{ $t(`admin.upgrade.${i18nKey}.description`) }}
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
          {{ loading ? $t('admin.upgrade.loading') : $t('admin.upgrade.cta', { plan: target }) }}
        </Button>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { getUpgradeTarget } from '~~/shared/utils/plans'

// Session, not `useClientSite()`: the banner offers a plan for whichever tenant Stripe will
// actually charge, and the host tenant is not always that one.
const { data: auth } = useAuth()
const { data: status } = await useClientSiteStatus()
const { t, tm, rt } = useI18n()
const toast = useToast()

const loading = shallowRef(false)

// Keyed per offered plan, so dismissing the PRO pitch does not also swallow the PREMIUM one
// the tenant becomes eligible for later.
const dismissed = useLocalStorage<string[]>('upsell-dismissed', [])

const target = computed(() => {
  const plan = getUpgradeTarget(auth.value?.user?.plan, status.value?.hasActiveSubscription)
  return plan && !dismissed.value.includes(plan) ? plan : null
})

const i18nKey = computed(() => (target.value === 'PREMIUM' ? 'toPremium' : 'toPro'))

const features = computed<string[]>(() => {
  if (!target.value) return []
  const messages = tm(`admin.upgrade.${i18nKey.value}.features`) as unknown[]
  return Array.isArray(messages) ? messages.map((m) => rt(m as string)) : []
})

const dismiss = () => {
  if (target.value) dismissed.value = [...dismissed.value, target.value]
}

const upgrade = async () => {
  if (!target.value) return
  loading.value = true
  try {
    const { url } = await $fetch<{ url: string }>('/api/stripe/subscribe', {
      method: 'POST',
      body: {
        plan: target.value,
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
