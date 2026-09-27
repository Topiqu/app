<script setup lang="ts">
defineProps<{ isPublic: boolean }>()

const confirmed = defineModel<boolean>('confirmed', { required: true })
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <UCheckbox v-model="confirmed" name="confirmed" required :label="$t('knowledge.consent.label')" />
    <UPopover :content="{ side: 'top', align: 'start' }">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="mdi:information-outline"
        :aria-label="$t('knowledge.consent.title')"
      />
      <template #content>
        <div class="flex max-w-sm flex-col gap-2 p-4 text-sm text-muted">
          <p class="font-semibold text-highlighted">{{ $t('knowledge.consent.title') }}</p>
          <p>{{ $t(isPublic ? 'knowledge.consent.usePublic' : 'knowledge.consent.useInternal') }}</p>
          <p>{{ $t('knowledge.consent.processing') }}</p>
          <p>{{ $t('knowledge.consent.scope') }}</p>
        </div>
      </template>
    </UPopover>
  </div>
</template>
