<template>
  <div class="space-y-2 rounded-(--ui-radius) border border-default p-3">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <UBadge color="neutral" variant="soft">{{ record.type }}</UBadge>
      <span class="text-muted">{{ label }}</span>
    </div>
    <div v-for="field in fields" :key="field.key" class="flex min-w-0 items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-xs text-muted">{{ $t(`common.domain.provisioning.dns.${field.key}`) }}</p>
        <p class="break-all font-mono text-xs text-highlighted">{{ field.value }}</p>
      </div>
      <UButton
        v-if="isSupported"
        color="neutral"
        variant="ghost"
        size="xs"
        :icon="copied && text === field.value ? 'mdi:check' : 'mdi:content-copy'"
        :aria-label="
          $t('common.domain.provisioning.dns.copy', { field: $t(`common.domain.provisioning.dns.${field.key}`) })
        "
        @click="copy(field.value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ record: { type: string; name: string; value: string }; label: string }>()
const { copy, copied, text, isSupported } = useClipboard({ legacy: true })
const fields = computed(() => [
  { key: 'name', value: props.record.name },
  { key: 'value', value: props.record.value },
])
</script>
