<template>
  <UFormField :label :description :error :required :name :hint class="w-full">
    <UTextarea
      v-if="type === 'textarea'"
      :id
      :modelValue="stringValue"
      :placeholder
      :maxlength="maxLength"
      :disabled
      autoresize
      class="w-full"
      @update:modelValue="emitValue"
      @blur="$emit('blur', $event)"
      @keydown="$emit('keydown', $event)"
    />
    <UCheckbox
      v-else-if="type === 'checkbox'"
      :modelValue="Boolean(modelValue)"
      :disabled
      @update:modelValue="emitValue"
    />
    <UInput
      v-else
      :id
      :modelValue="stringValue"
      :type
      :placeholder
      :maxlength="maxLength"
      :min
      :max
      :step
      :disabled
      :readonly
      :required
      :name
      :autocomplete
      :leadingIcon="iconPosition === 'trailing' ? undefined : icon"
      :trailingIcon="iconPosition === 'trailing' ? icon : undefined"
      class="w-full"
      @update:modelValue="emitValue"
      @blur="$emit('blur', $event)"
      @keydown="$emit('keydown', $event)"
    >
      <template v-if="$slots.icon" #trailing><slot name="icon" /></template>
    </UInput>
  </UFormField>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string | number | boolean | null
    id?: string
    label?: string
    description?: string
    error?: string | boolean
    hint?: string
    name?: string
    type?: string
    placeholder?: string
    maxLength?: number
    min?: string | number
    max?: string | number
    step?: string | number
    icon?: string
    iconPosition?: 'leading' | 'trailing'
    autocomplete?: string
    disabled?: boolean
    readonly?: boolean
    required?: boolean
  }>(),
  { type: 'text', iconPosition: 'leading' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
  blur: [event: FocusEvent]
  keydown: [event: KeyboardEvent]
}>()

const stringValue = computed(() => String(props.modelValue ?? ''))
const emitValue = (value: string | number | boolean | undefined) => {
  if (props.type === 'number') emit('update:modelValue', Number(value ?? 0))
  else emit('update:modelValue', value ?? '')
}
</script>
