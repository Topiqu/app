<template>
  <UNavigationMenu
    :items="items"
    orientation="vertical"
    class="w-full shrink-0 md:sticky md:top-6 md:w-52 md:self-start"
    :aria-label="$t('common.preferences.title')"
  />
</template>

<script setup lang="ts">
export interface SettingsTab {
  id: string
  labelKey: string
  icon: string
}

const props = defineProps<{ tabs: SettingsTab[] }>()
const active = defineModel<string>({ required: true })
const items = computed(() =>
  props.tabs.map((tab) => ({
    label: $t(tab.labelKey),
    icon: tab.icon,
    active: tab.id === active.value,
    onSelect: () => (active.value = tab.id),
  })),
)
</script>
