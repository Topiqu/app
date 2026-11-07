<template>
  <UButton
    v-if="enabled && data && canStart && !open"
    size="sm"
    color="neutral"
    variant="ghost"
    icon="mdi:web-sync"
    :label="$t(data.import ? 'common.websiteImport.start.again' : 'common.websiteImport.start.open')"
    data-website-import-entry
    @click="rerun = true"
  />
</template>

<script setup lang="ts">
const { data, enabled } = useWebsiteImport()
const { open, rerun, canStart } = useWebsiteImportCard()
</script>
