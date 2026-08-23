<template>
  <div
    class="flex max-h-[20rem] min-w-[12rem] flex-col gap-1 overflow-x-hidden overflow-y-auto rounded-xl border border-default bg-elevated p-1.5 shadow-lg"
  >
    <div v-for="(item, i) in items" :key="i" :ref="(el) => (refs[i] = el as HTMLElement)" class="w-full">
      <UButton
        :icon="item.icon"
        :title="item.title"
        :color="i === selected ? 'primary' : 'neutral'"
        :variant="i === selected ? 'solid' : 'soft'"
        size="sm"
        class="w-full"
        @click="exec(i)"
      >
        {{ item.title }}
      </UButton>
    </div>
    <div v-if="!items.length" class="px-3 py-2 text-center text-xs text-muted">{{ $t('common.noResults') }}</div>
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
