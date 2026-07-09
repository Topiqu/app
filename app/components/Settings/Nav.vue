<template>
  <nav
    class="flex md:flex-col gap-1.5 md:w-52 shrink-0 overflow-x-auto md:overflow-visible snap-x md:snap-none -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0 md:sticky md:top-6 md:self-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    :aria-label="$t('common.preferences.title')"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="group flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap snap-start transition-colors duration-150"
      :class="
        tab.id === active
          ? '!bg-neutral-900 !text-white dark:!bg-neutral-100 dark:!text-neutral-900 shadow-sm'
          : '!bg-transparent !text-neutral-600 dark:!text-neutral-300 hover:!bg-neutral-100 dark:hover:!bg-neutral-800/70'
      "
      :aria-current="tab.id === active ? 'page' : undefined"
      @click="active = tab.id"
    >
      <Icon :name="tab.icon" class="size-[1.15rem] shrink-0 opacity-90" />
      <span class="text-inherit">{{ $t(tab.labelKey) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
export interface SettingsTab {
  id: string
  labelKey: string
  icon: string
}

defineProps<{ tabs: SettingsTab[] }>()
const active = defineModel<string>({ required: true })
</script>
