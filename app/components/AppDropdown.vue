<template>
  <UDropdownMenu :items="items">
    <slot />
  </UDropdownMenu>
</template>

<script setup lang="ts">
type LegacyItem = { id?: string; label: string; icon?: string; disabled?: boolean; onClick?: () => void }

const props = defineProps<{ groups: LegacyItem[][] }>()

const items = computed(() =>
  props.groups.map((group) =>
    group.map((item) => ({
      ...item,
      icon: item.icon?.startsWith('i-') ? item.icon : item.icon?.replace(':', '-').replace(/^/, 'i-'),
      onSelect: item.onClick,
    })),
  ),
)
</script>
