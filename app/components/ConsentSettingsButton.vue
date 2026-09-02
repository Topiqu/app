<template>
  <UTooltip v-if="decision && !settingsOpen" :text="$t('common.consent.openSettings')">
    <UButton
      square
      color="neutral"
      variant="soft"
      icon="mdi:cookie-settings-outline"
      :ui="{
        base: 'bottom-action-bar fixed right-6 bottom-4 z-overlay size-11 rounded-[var(--ui-radius)] border border-default bg-default shadow-lg sm:right-8 sm:bottom-6',
      }"
      :aria-label="$t('common.consent.openSettings')"
      @click="settingsOpen = true"
    />
  </UTooltip>
</template>

<script setup lang="ts">
const decision = useConsentDecision()
const settingsOpen = useConsentSettingsOpen()
</script>
