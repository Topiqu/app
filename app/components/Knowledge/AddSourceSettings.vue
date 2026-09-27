<script setup lang="ts">
const props = defineProps<{ kind: 'NOTE' | 'FILE' | 'URL'; today: string; showTitle: boolean }>()

const validAsOf = defineModel<string>('validAsOf', { required: true })
const isPublic = defineModel<boolean>('isPublic', { required: true })
const publicUrl = defineModel<string>('publicUrl', { required: true })
const title = defineModel<string>('title', { required: true })

const { t } = useI18n()

// Reka radio values cannot be booleans.
const citation = computed({
  get: () => (isPublic.value ? 'PUBLIC' : 'INTERNAL'),
  set: (value) => (isPublic.value = value === 'PUBLIC'),
})
const citationItems = computed(() =>
  (['INTERNAL', 'PUBLIC'] as const).map((value) => ({
    value,
    label: t(`knowledge.citation.${value}.label`),
    description: t(`knowledge.citation.${value}.description`),
  })),
)
const needsPublicUrl = computed(() => isPublic.value && props.kind !== 'URL')
</script>

<template>
  <URadioGroup
    v-model="citation"
    :legend="$t('knowledge.citation.legend')"
    :items="citationItems"
    variant="card"
    class="w-full"
    :ui="{ legend: 'mb-2 font-medium', item: 'rounded-(--topiqu-surface-radius)' }"
  />
  <UFormField v-if="needsPublicUrl" :label="$t('knowledge.fields.publicUrl')" required>
    <UInput v-model="publicUrl" type="url" class="w-full" placeholder="https://" required />
  </UFormField>

  <details class="group">
    <summary
      class="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted hover:text-highlighted [&::-webkit-details-marker]:hidden"
    >
      <UIcon name="mdi:chevron-right" class="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
      {{ $t(showTitle ? 'knowledge.details.titleAndDate' : 'knowledge.details.date') }}
      <span class="font-normal">({{ $t('knowledge.fields.optional').toLocaleLowerCase() }})</span>
    </summary>
    <div class="mt-3 flex flex-col gap-4 pl-5">
      <UFormField v-if="showTitle" :label="$t('knowledge.fields.title')">
        <UInput v-model="title" class="w-full" maxlength="200" />
      </UFormField>
      <UFormField :label="$t('knowledge.fields.validAsOf')" :hint="$t('knowledge.fields.validAsOfAddHint')">
        <AppDateInput v-model="validAsOf" :max="today" />
      </UFormField>
    </div>
  </details>
</template>
