<template>
  <section
    class="@container overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    aria-labelledby="agency-plan-title"
  >
    <header class="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
      <div class="min-w-0">
        <h2 id="agency-plan-title" class="font-semibold text-highlighted">{{ $t('agency.plan.title') }}</h2>
        <p v-if="live" class="mt-0.5 text-sm text-muted">
          {{ $t('agency.plan.current', { price: usd(currentCents) }) }}
        </p>
      </div>
      <UButton
        v-if="owner && agency.hasBillingPortal"
        size="sm"
        color="neutral"
        variant="ghost"
        trailingIcon="mdi:open-in-new"
        :loading="portalLoading"
        @click="portal()"
      >
        {{ $t('agency.plan.portal') }}
      </UButton>
    </header>

    <div class="flex flex-col gap-5 p-5">
      <UAlert
        v-if="agency.status === 'PAST_DUE'"
        color="warning"
        variant="subtle"
        icon="mdi:alert-outline"
        :title="$t('agency.plan.pastDue')"
      />
      <p v-if="!owner || !live" class="text-sm leading-6 text-toned">{{ summary }}</p>

      <div v-if="owner" class="grid items-start gap-5 @2xl:grid-cols-2 @2xl:gap-10">
        <AgencyQuantities
          v-model:blogs="blogs"
          v-model:premium="premium"
          v-model:blocks="blocks"
          :catalog
          :minBlogs
          :minPremium="slots.premium"
        />
        <div class="flex flex-col gap-4">
          <AgencyPriceBreakdown :blogs :premium :blocks :catalog :currentCents="live ? currentCents : undefined" />
          <p v-if="live && changed" class="text-xs leading-5 text-muted">
            {{ $t(increase ? 'agency.plan.increaseNote' : 'agency.plan.decreaseNote') }}
          </p>
          <UButton
            v-if="live"
            block
            icon="mdi:content-save-outline"
            :disabled="!changed || !valid"
            :loading="changing"
            @click="change(quantities)"
          >
            {{ $t('agency.plan.save') }}
          </UButton>
          <UButton
            v-else
            block
            size="lg"
            icon="mdi:credit-card-outline"
            :disabled="!valid"
            :loading="subscribing"
            @click="subscribe(quantities)"
          >
            {{ $t('agency.plan.subscribe') }}
          </UButton>
        </div>
      </div>
      <p v-else class="text-xs text-muted">{{ $t('agency.plan.ownerOnly') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AgencyQuantities as Quantities } from '~~/shared/utils/agencyPlan'

import type { AgencyAccount, AgencyCatalog } from '~/composables/useAgency'

const { agency, catalog, slots } = defineProps<{
  agency: AgencyAccount
  catalog: AgencyCatalog
  owner: boolean
  /** Slots the attached blogs take now; the subscription cannot go below them. */
  slots: { paid: number; premium: number }
}>()

const { t, locale } = useI18n()
const usd = useUsd()
const draft = useAgencyDraft(catalog)
const live = computed(() => isAgencyLive(agency.status))
// Checkout refuses fewer slots than blogs already on Pro or Premium.
const minBlogs = computed(() => Math.max(catalog.minBlogs, slots.paid))
const blogs = shallowRef<number | null>(null)
const premium = shallowRef<number | null>(null)
const blocks = shallowRef<number | null>(null)
watch(
  () => [agency.blogSlots, agency.premiumSlots, agency.unitBlocks, minBlogs.value, slots.premium, live.value] as const,
  ([blogSlots, premiumSlots, unitBlocks, min, minPremium, isLive]) => {
    blogs.value = Math.max(isLive ? blogSlots : draft.value.blogs, min)
    premium.value = Math.max(isLive ? premiumSlots : draft.value.premium, minPremium)
    blocks.value = Math.max(isLive ? unitBlocks : draft.value.blocks, catalog.minBlocks)
  },
  { immediate: true },
)

const quantities = computed(() => ({ blogs: blogs.value ?? 0, premium: premium.value ?? 0, blocks: blocks.value ?? 0 }))
const current = computed(() => ({ blogs: agency.blogSlots, premium: agency.premiumSlots, blocks: agency.unitBlocks }))
const valid = computed(
  () =>
    isAgencyQuantities(quantities.value) &&
    quantities.value.blogs >= slots.paid &&
    quantities.value.premium >= slots.premium,
)
const keys = ['blogs', 'premium', 'blocks'] as const
const changed = computed(() => keys.some((key) => quantities.value[key] !== current.value[key]))
const increase = computed(() => keys.some((key) => quantities.value[key] > current.value[key]))
const currentCents = computed(() => agencyPriceCents(current.value))
const summary = computed(() =>
  live.value
    ? t(agency.premiumSlots ? 'agency.plan.summaryPremium' : 'agency.plan.summary', {
        blogs: agency.blogSlots,
        premium: agency.premiumSlots,
        units: agencyUnits(agency.unitBlocks),
        price: usd(currentCents.value),
      })
    : t('agency.plan.inactive'),
)

const redirect = async (request: Promise<{ url: string | null }>) => {
  const { url } = await request
  if (!url) throw new Error('No billing URL')
  await navigateTo(url, { external: true })
}

const { mutate: subscribe, isLoading: subscribing } = useAgencyMutation((body: Quantities) =>
  redirect(
    $fetch<{ url: string | null }, '/api/agency/checkout'>('/api/agency/checkout', {
      method: 'POST',
      body: { ...body, origin: window.location.origin, locale: locale.value },
    }),
  ),
)
const { mutate: portal, isLoading: portalLoading } = useAgencyMutation(() =>
  redirect(
    $fetch<{ url: string | null }, '/api/agency/portal'>('/api/agency/portal', {
      method: 'POST',
      body: { origin: window.location.origin, locale: locale.value },
    }),
  ),
)
const { mutate: change, isLoading: changing } = useAgencyMutation(
  async (body: Quantities) => {
    const result = await $fetch<{ pending: boolean; invoiceUrl: string | null }, '/api/agency/plan'>(
      '/api/agency/plan',
      { method: 'POST', body },
    )
    // A raise that the saved card did not cover waits on this invoice.
    if (result.pending && result.invoiceUrl) await navigateTo(result.invoiceUrl, { external: true })
    return result
  },
  (result) => (result.pending ? 'agency.plan.pendingPayment' : 'agency.plan.saved'),
)
</script>
