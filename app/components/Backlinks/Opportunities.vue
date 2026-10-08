<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div>
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">
        {{ $t('backlinks.opportunities.title') }}
      </h2>
      <p class="mt-1 text-sm text-muted">{{ $t('backlinks.opportunities.description') }}</p>
    </div>

    <p
      v-if="!opportunities.length"
      class="flex items-center gap-2 rounded-(--topiqu-surface-radius) border border-dashed border-default px-4 py-3 text-sm text-muted"
    >
      <UIcon name="mdi:link-plus" class="size-4 shrink-0" aria-hidden="true" />
      {{ data?.running ? $t('backlinks.running') : $t('backlinks.opportunities.empty') }}
    </p>
    <ul
      v-else
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <BacklinksOpportunityItem
        v-for="opportunity in opportunities"
        :key="opportunity.id"
        :opportunity
        :drafts="data?.allowance.drafts ?? false"
        :busy="busy === opportunity.id"
        @run="run(opportunity, $event)"
      />
    </ul>
    <p v-if="data && !data.allowance.kinds.includes('SUPPLIER')" class="text-xs text-muted">
      {{ $t('backlinks.opportunities.suppliersLocked') }}
    </p>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const headingId = useId()
const busy = shallowRef<string | null>(null)

const { data, refetch } = useBacklinks()
// Requests already sent first: they are the ones waiting on someone else.
const opportunities = computed(() =>
  [...(data.value?.opportunities ?? [])].sort((a, b) => Number(b.status === 'SENT') - Number(a.status === 'SENT')),
)

const CHECK_TOAST = {
  won: 'success',
  missing: 'neutral',
  unreadable: 'warning',
  expired: 'neutral',
} as const

const run = async (opportunity: BacklinkOpportunityView, command: BacklinkCommand) => {
  busy.value = opportunity.id
  try {
    const result = await $fetch<{ outcome?: keyof typeof CHECK_TOAST }>(`/api/backlinks/${opportunity.id}`, {
      method: 'POST',
      body: { action: command },
    })
    await refetch()
    if (result.outcome)
      toast.add({ color: CHECK_TOAST[result.outcome], title: t(`backlinks.opportunities.check.${result.outcome}`) })
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('backlinks.failed')) })
  } finally {
    busy.value = null
  }
}
</script>
