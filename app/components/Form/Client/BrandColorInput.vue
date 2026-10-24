<template>
  <div class="flex items-center gap-2">
    <UPopover v-if="display !== 'hex'" :content="{ align: 'start' }">
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        size="swatch"
        square
        :style="{ backgroundColor: modelValue }"
        :aria-label="label"
      >
        <UIcon
          v-if="display === 'swatch'"
          name="mdi:eyedropper-variant"
          size="18"
          :style="{ color: contrastRatio(modelValue, '#FFFFFF') >= 3 ? '#FFFFFF' : '#0F172A' }"
          aria-hidden="true"
        />
      </UButton>
      <template #content>
        <div class="w-64 p-3">
          <UFormField :label :ui="{ label: 'sr-only' }">
            <UColorPicker :modelValue="modelValue" :throttle="0" @update:modelValue="updatePicker" />
          </UFormField>
        </div>
      </template>
    </UPopover>
    <UInput
      v-if="display !== 'swatch'"
      :modelValue="draft"
      :aria-label="label"
      size="sm"
      maxlength="7"
      spellcheck="false"
      autocapitalize="off"
      class="min-w-0 flex-1"
      :ui="{ base: 'font-mono uppercase' }"
      @update:modelValue="updateText(String($event))"
      @blur="draft = modelValue.toUpperCase()"
    />
  </div>
</template>

<script setup lang="ts">
const { modelValue, display = 'both' } = defineProps<{
  modelValue: string
  label: string
  display?: 'both' | 'swatch' | 'hex'
}>()
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
