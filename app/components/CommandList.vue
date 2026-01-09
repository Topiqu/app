<template>
  <div
    class="flex flex-col gap-1 p-1.5 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-gray-200/50 dark:border-neutral-700/50 min-w-[12rem] max-h-[20rem] overflow-y-auto overflow-x-hidden scrollbar-hide"
  >
    <div v-for="(item, i) in items" :key="i" :ref="(el) => (refs[i] = el as HTMLElement)" class="w-full">
      <Button
        :icon="item.icon"
        :title="item.title"
        variant="neutral"
        size="sm"
        borderless
        class="!justify-start w-full text-sm font-medium truncate"
        :class="{ '!bg-blue-100 !text-blue-700 dark:!bg-blue-900 dark:!text-blue-100': i === selected }"
        @click="exec(i)"
      >
        {{ item.title }}
      </Button>
    </div>
    <div v-if="!items.length" class="px-3 py-2 text-xs text-gray-400 text-center">{{ $t('common.noResults') }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ items: any[]; command: any }>()
const selected = shallowRef(0),
  refs = ref<HTMLElement[]>([])

watch(
  () => props.items,
  () => ((selected.value = 0), (refs.value = [])),
)

const exec = (i: number) => props.items[i] && props.command(props.items[i])

const nav = (dir: number) => {
  selected.value = (selected.value + dir + props.items.length) % props.items.length
  nextTick(() => refs.value[selected.value]?.scrollIntoView({ block: 'nearest' }))
}

const onKeyDown = ({ event }: { event: KeyboardEvent }) => {
  if (event.key === 'Enter') return (exec(selected.value), true)
  if (['ArrowUp', 'ArrowDown'].includes(event.key)) return (nav(event.key === 'ArrowUp' ? -1 : 1), true)
  return false
}

defineExpose({ onKeyDown })
</script>
