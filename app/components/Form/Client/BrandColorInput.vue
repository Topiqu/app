<template>
  <div class="flex items-center gap-2">
    <UPopover :content="{ align: 'start' }">
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        square
        class="size-10 shrink-0"
        :style="{ backgroundColor: modelValue }"
        :aria-label="label"
      />
      <template #content>
        <div class="w-64 p-3">
          <UFormField :label :ui="{ label: 'sr-only' }">
            <UColorPicker :modelValue="modelValue" :throttle="0" @update:modelValue="updatePicker" />
          </UFormField>
        </div>
      </template>
    </UPopover>
    <UInput
      :modelValue="draft"
      :aria-label="label"
      maxlength="7"
      class="min-w-0 flex-1"
      :ui="{ base: 'font-mono uppercase' }"
      @update:modelValue="updateText(String($event))"
      @blur="draft = modelValue.toUpperCase()"
    />
  </div>
</template>

<script setup lang="ts">
const { modelValue } = defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [color: string] }>()
const draft = shallowRef(modelValue.toUpperCase())

watch(
  () => modelValue,
  (value) => (draft.value = value.toUpperCase()),
)

const updateText = (value: string) => {
  draft.value = value
  if (/^#[0-9a-fA-F]{6}$/.test(value)) emit('update:modelValue', value.toUpperCase())
}

const updatePicker = (value: string | undefined) => {
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) return
  value = value.toUpperCase()
  draft.value = value
  emit('update:modelValue', value)
}
</script>
