<template>
  <div class="min-h-[100dvh]">
    <div class="relative z-10">
      <main>
        <LandingHero @scroll="scrollToSection" />

        <UPageSection id="specs" :title="$t('landing.specs.title')" :description="$t('landing.specs.subtitle')">
          <UPageGrid>
            <UPageCard
              class="md:col-span-2"
              icon="i-mdi-robot-happy-outline"
              :title="$t('landing.specs.ai.title')"
              :description="$t('landing.specs.ai.desc')"
              highlight
            >
              <template #header>
                <UBadge color="primary" variant="soft">{{ $t('landing.specs.ai.badge') }}</UBadge>
              </template>
              <template #footer>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="tag in ['enhance', 'vibe', 'helpfulness']"
                    :key="tag"
                    color="primary"
                    variant="soft"
                    icon="i-mdi-check-decagram"
                  >
                    {{ $t(`landing.specs.ai.tags.${tag}`) }}
                  </UBadge>
                </div>
              </template>
            </UPageCard>

            <UPageCard
              class="md:row-span-2"
              icon="i-mdi-currency-usd"
              :title="$t('landing.specs.monetization.title')"
              :description="$t('landing.specs.monetization.desc')"
              highlight
              highlightColor="success"
            />

            <UPageCard
              icon="i-mdi-shield-check"
              :title="$t('landing.specs.security.title')"
              highlight
              highlightColor="error"
            >
              <ul class="space-y-3 text-sm text-muted">
                <li v-for="feature in securityFeatures" :key="feature" class="flex items-center gap-2">
                  <UIcon name="i-mdi-check-circle" size="16" />{{ feature }}
                </li>
              </ul>
            </UPageCard>

            <UPageCard
              icon="i-mdi-api"
              :title="$t('landing.specs.api.title')"
              :description="$t('landing.specs.api.desc')"
            >
              <template #header><UBadge color="neutral" variant="soft">JSON/REST</UBadge></template>
              <code class="text-sm text-muted">const { data } = useFetch(...)</code>
            </UPageCard>
          </UPageGrid>
        </UPageSection>

        <LandingPricing @startOnboarding="startOnboarding" />

        <LandingFaq />
      </main>

      <UFooter>
        <div class="flex flex-col items-center justify-center gap-4 text-center">
          <UAvatar src="/topik_normal_rm.png" alt="" size="3xl" />
          <p class="mx-auto max-w-sm text-sm font-medium text-muted">
            {{ $t('landing.footer.desc') }}
          </p>
          <div class="flex justify-center gap-8 text-sm font-bold">
            <ULink :to="localePath({ name: 'tos' })">{{ $t('common.links.terms') }}</ULink>
            <ULink :to="localePath({ name: 'privacy' })">{{ $t('common.links.privacy') }}</ULink>
          </div>
          <p class="text-xs text-muted">
            &copy; {{ new Date().getFullYear() }} Topiqu {{ $t('landing.footer.rights') }}
          </p>
        </div>
      </UFooter>

      <LandingOnboardingModal v-if="showOnboarding" v-model:open="showOnboarding" />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const showOnboarding = computed({
  get: () => route.query.onboarding === '1',
  set: (open: boolean) => {
    const query = { ...route.query }
    if (open) query.onboarding = '1'
    else delete query.onboarding
    router.replace({ query })
  },
})

watch(showOnboarding, async (open, wasOpen) => {
  if (open || !wasOpen) return
  await nextTick()
  document.querySelector<HTMLElement>('a[href*="onboarding=1"]')?.focus()
})
const startOnboarding = () => {
  showOnboarding.value = true
}
const localePath = useLocalePath()
const securityFeatures = computed(() => [
  $t('landing.specs.security.list.rbac'),
  $t('landing.specs.security.list.mfa'),
  $t('landing.specs.security.list.hashing'),
  $t('landing.specs.security.list.antibot'),
])

const scrollToSection = (id: string) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>
