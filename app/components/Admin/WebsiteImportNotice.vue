<template>
  <section
    v-if="enabled && job && job.status !== 'REVIEWED'"
    class="pointer-events-auto w-88 max-w-[calc(100vw-1.5rem)] rounded-(--topiqu-surface-radius) border border-default bg-default p-3"
    data-website-import-notice
    aria-live="polite"
  >
    <div class="flex items-start gap-3">
      <UIcon
        :name="
          job.status === 'READY'
            ? 'mdi:check-circle-outline'
            : job.status === 'FAILED'
              ? 'mdi:alert-circle-outline'
              : 'mdi:web-sync'
        "
        class="mt-0.5 size-5 shrink-0 text-muted"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-highlighted">{{ $t(`common.websiteImport.status.${job.status}`) }}</p>
        <p class="mt-1 truncate text-xs text-muted">{{ job.sourceUrl }}</p>
        <UButton
          :to="localePath({ name: 'settings', query: { tab: 'content', websiteImport: job.id } })"
          class="mt-2"
          size="xs"
          color="neutral"
          variant="soft"
          :label="$t(job.status === 'READY' ? 'common.websiteImport.review' : 'common.websiteImport.open')"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data, enabled } = useWebsiteImport()
const job = computed(() => data.value?.import)
const localePath = useLocalePath()
</script>
