<template>
  <section
    class="grid overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default lg:grid-cols-[minmax(0,1fr)_25rem]"
    aria-labelledby="agency-create-title"
  >
    <div class="flex flex-col gap-10 p-6 sm:p-10">
      <div class="max-w-xl space-y-4">
        <p class="text-sm font-semibold text-primary">{{ $t('agency.create.eyebrow') }}</p>
        <h2
          id="agency-create-title"
          class="text-3xl font-semibold tracking-tight text-balance text-highlighted sm:text-4xl"
        >
          {{ $t('agency.create.headline') }}
        </h2>
        <p class="text-base leading-7 text-toned">{{ $t('agency.create.description') }}</p>
      </div>
      <dl class="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div v-for="benefit in benefits" :key="benefit.icon" class="flex gap-4">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <UIcon :name="benefit.icon" class="size-5" />
          </span>
          <div>
            <dt class="font-semibold text-highlighted">{{ benefit.title }}</dt>
            <dd class="mt-1 text-sm leading-6 text-muted">{{ benefit.text }}</dd>
          </div>
        </div>
      </dl>
    </div>

    <form
      class="flex flex-col gap-6 border-t border-default bg-elevated/50 p-6 sm:p-8 lg:border-t-0 lg:border-l"
      @submit.prevent="submit"
    >
      <h3 class="text-lg font-semibold text-highlighted">{{ $t('agency.create.calculator') }}</h3>
      <AgencyQuantities
        v-model:blogs="draft.blogs"
        v-model:premium="draft.premium"
        v-model:blocks="draft.blocks"
        :catalog
      />
      <AgencyPriceBreakdown :blogs="draft.blogs" :premium="draft.premium" :blocks="draft.blocks" :catalog />
      <div class="space-y-3 border-t border-default pt-6">
        <UFormField :label="$t('agency.create.name')" name="name" required>
          <UInput v-model.trim="name" size="lg" class="w-full" :maxlength="80" autocomplete="organization" />
        </UFormField>
        <UButton type="submit" size="lg" block :loading="isLoading" :disabled="!name">
          {{ $t('agency.create.submit') }}
        </UButton>
        <p class="text-xs leading-5 text-muted">{{ $t('agency.create.footnote') }}</p>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { AgencyCatalog } from '~/composables/useAgency'

const { catalog } = defineProps<{ catalog: AgencyCatalog }>()

const ICONS = ['mdi:chart-donut', 'mdi:receipt-text-outline', 'mdi:account-group-outline', 'mdi:calendar-sync-outline']

const { tm, rt } = useI18n()
const name = shallowRef('')
const draft = useAgencyDraft(catalog)
const benefits = computed(() =>
  (tm('agency.create.benefits') as { title: unknown; text: unknown }[]).map((benefit, index) => ({
    icon: ICONS[index] ?? 'mdi:check',
    title: rt(benefit.title as string),
    text: rt(benefit.text as string),
  })),
)

const { mutate, isLoading } = useAgencyMutation(
  (body: { name: string }) => $fetch<unknown, '/api/agency'>('/api/agency', { method: 'POST', body }),
  'agency.create.created',
)
const submit = () => name.value && mutate({ name: name.value })
</script>
