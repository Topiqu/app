<template>
  <UPopover v-model:open="open" :portal="portal" :content="{ align: 'end', sideOffset: 8 }" @update:open="onOpenChange">
    <UButton
      color="neutral"
      variant="ghost"
      square
      :size="size"
      class="relative"
      :aria-label="$t(`articles.editor.toolbar.${labelKey}`)"
      :title="$t(`articles.editor.toolbar.${labelKey}`)"
      :icon="labelKey === 'cellColor' ? 'mdi:format-color-fill' : 'mdi:format-color-text'"
    >
      <template #trailing>
        <span
          class="pointer-events-none absolute bottom-1 right-1 size-2 rounded-full ring-1 ring-default"
          :style="{ backgroundColor: (open ? draftColor : modelValue) || '#000000' }"
        />
      </template>
    </UButton>

    <template #content>
      <div class="w-72 space-y-4 p-4" @pointerdown="onPointerDown">
        <UFormField :label="$t(`articles.editor.toolbar.${labelKey}`)" :ui="{ label: 'sr-only' }">
          <UColorPicker :modelValue="draftColor" :throttle="0" class="w-full" @update:modelValue="onDraftChange" />
        </UFormField>
        <USeparator />
        <div class="flex items-center justify-between gap-3 pt-3">
          <code class="text-sm text-muted">{{ draftColor.toUpperCase() }}</code>
          <UButton
            v-if="modelValue || dirty"
            color="error"
            variant="ghost"
            size="sm"
            :label="$t('articles.editor.toolbar.removeColor')"
            @click="removeColor"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const {
  labelKey = 'textColor',
  portal = true,
  size = 'md',
} = defineProps<{
  labelKey?: 'textColor' | 'cellColor'
  portal?: boolean
  size?: 'sm' | 'md'
}>()
const modelValue = defineModel<string>()
const open = shallowRef(false)
const draftColor = shallowRef('#FFFFFF')
const dirty = shallowRef(false)
let dragging = false

const commitDraft = () => {
  if (!dirty.value) return
  dirty.value = false
  modelValue.value = draftColor.value
}

const onOpenChange = (value: boolean) => {
  if (value) {
    draftColor.value = modelValue.value || '#FFFFFF'
    dirty.value = false
  } else {
    dragging = false
    commitDraft()
  }
}

const onDraftChange = (value: string | undefined) => {
  if (!value) return
  draftColor.value = value
  dirty.value = true
}

const onPointerDown = (event: PointerEvent) => {
  if (!(event.target instanceof Element && event.target.closest('[data-slot="picker"]'))) return
  // Stops text selection and focus shifts while dragging across the color area.
  event.preventDefault()
  dragging = true
}

const onPointerUp = async () => {
  if (!dragging) return
  dragging = false
  await nextTick()
  commitDraft()
}

const removeColor = () => {
  dirty.value = false
  draftColor.value = '#FFFFFF'
  modelValue.value = ''
  open.value = false
}

onMounted(() => window.addEventListener('pointerup', onPointerUp))
onBeforeUnmount(() => window.removeEventListener('pointerup', onPointerUp))
</script>
