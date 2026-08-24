<template>
  <UTooltip v-if="decision && !settingsOpen" :text="$t('common.consent.openSettings')">
    <UButton
      square
      color="neutral"
      variant="soft"
      icon="i-mdi-cookie-settings-outline"
      :ui="{ base: 'bottom-action-bar fixed right-3 bottom-3 z-overlay shadow-lg' }"
      :aria-label="$t('common.consent.openSettings')"
      @click="settingsOpen = true"
    />
  </UTooltip>
</template>

<script setup lang="ts">
const decision = useConsentDecision()
const settingsOpen = useConsentSettingsOpen()
</script>
