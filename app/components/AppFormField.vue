<template>
  <UFormField :label :description :error :required :name :hint class="w-full">
    <template v-if="type === 'textarea' && maxLength" #hint>
      <span
        class="tabular-nums"
        :class="
          stringValue.length >= maxLength
            ? 'text-error'
            : stringValue.length >= maxLength * 0.9
              ? 'text-warning'
              : 'text-muted'
        "
      >
        {{ stringValue.length }}/{{ maxLength }}
      </span>
    </template>
    <UTextarea
      v-if="type === 'textarea'"
      :id
      :modelValue="stringValue"
      :placeholder
      :maxlength="maxLength"
      :rows
      :name
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
const {
  modelValue,
  id,
  label,
  description,
  error,
  hint,
  name,
  type = 'text',
  placeholder,
  maxLength,
  rows,
  min,
  max,
  step,
  icon,
  iconPosition = 'leading',
  autocomplete,
  disabled,
  readonly,
  required,
} = defineProps<{
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
  rows?: number
  min?: string | number
  max?: string | number
  step?: string | number
  icon?: string
  iconPosition?: 'leading' | 'trailing'
  autocomplete?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
  blur: [event: FocusEvent]
  keydown: [event: KeyboardEvent]
}>()

const stringValue = computed(() => String(modelValue ?? ''))
const emitValue = (value: string | number | boolean | undefined) => {
  if (type === 'number') emit('update:modelValue', Number(value ?? 0))
  else emit('update:modelValue', value ?? '')
}
</script>
