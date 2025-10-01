<template>
  <div v-bind="attrs">
    <FormLabel v-if="$slots.default || label" :for="idAttr?.toString() || id" :text="label" :icon="labelIcon" />
    <FormInput :id="idAttr?.toString() || id" v-bind="props" v-model="value" />
  </div>
</template>

<script lang="ts" setup generic="T extends InputHTMLAttributes['type'] | 'textarea'">
import type { InputHTMLAttributes } from 'vue'

import type { InputTypeValue } from './Input.vue'

defineOptions({ inheritAttrs: false })

const { id: idAttr, ...attrs } = useAttrs()

const id = useId()

const { label, labelIcon, ...props } = defineProps<{
  label?: string
  labelIcon?: string
  icon?: string
  iconPosition?: 'leading' | 'trailing'
  type?: T
  name?: string
  placeholder?: string
  required?: boolean
  readonly?: boolean
  disabled?: boolean
  maxLength?: number
}>()

const value = defineModel<InputTypeValue<T>>()
</script>
