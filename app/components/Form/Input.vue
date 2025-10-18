<template>
  <div v-bind="attrs" class="relative flex flex-col w-full">
    <div class="relative flex items-center">
      <slot name="icon">
        <div
          class="absolute top-1/2 -translate-y-1/2 flex items-center justify-center size-6 text-xl text-gray-400 pointer-events-none"
          :class="iconPosition === 'trailing' ? 'right-3' : 'left-3'"
        >
          <Icon v-if="icon" :name="icon" class="size-full text-[inherit]" />
        </div>
      </slot>
      <textarea
        v-if="type === 'textarea' && typeof value !== 'boolean' && !(value instanceof Date)"
        :id="idAttr?.toString() || id"
        v-model="value"
        v-bind="props"
        :type
        class="w-full h-[164px] min-h-12 max-h-[40vh] max-xl:max-h-[30vh] px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer transition resize-y"
        :class="icon && (iconPosition === 'trailing' ? 'pr-10!' : 'pl-10!')"
      />
      <input
        v-else
        :id="idAttr?.toString() || id"
        v-model="value"
        v-bind="props"
        :type
        class="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer transition"
        :class="icon && (iconPosition === 'trailing' ? 'pr-10!' : 'pl-10!')"
      />
    </div>

    <div
      v-if="props.maxLength"
      class="mt-1 text-xs text-right"
      :class="
        valueLength >= props.maxLength
          ? 'text-red-500 dark:text-red-400 font-medium'
          : 'text-gray-400 dark:text-neutral-500'
      "
    >
      {{ valueLength }} / {{ props.maxLength }}
    </div>

    <div
      v-if="props.maxLength"
      class="relative w-full h-0.5 bg-gray-200 dark:bg-neutral-700 mt-1 rounded overflow-hidden"
    >
      <div
        class="absolute top-0 left-0 h-full transition-all duration-300"
        :class="valueLength >= props.maxLength ? 'bg-red-500' : 'bg-indigo-500 !dark:bg-indigo-400'"
        :style="{ width: Math.min((valueLength / props.maxLength) * 100, 100) + '%' }"
      />
    </div>
  </div>
</template>

<script lang="ts" setup generic="T extends InputHTMLAttributes['type'] | 'textarea'">
import type { InputHTMLAttributes } from 'vue'

export type InputTypeValue<T> = T extends 'datetime-local' | 'date'
  ? Date
  : T extends 'checkbox'
    ? boolean
    : string | number | null

export interface FormInputProps<T> {
  icon?: string
  iconPosition?: 'leading' | 'trailing'
  type?: T
  name?: string
  placeholder?: string
  required?: boolean
  readonly?: boolean
  disabled?: boolean
  maxLength?: number
}

const id = useId()
defineOptions({ inheritAttrs: false })

const { id: idAttr, ...attrs } = useAttrs()
const { type = 'text', iconPosition = 'leading', ...props } = defineProps<FormInputProps<T>>()
const value = defineModel<InputTypeValue<T>>()

const valueLength = computed(() =>
  typeof value.value === 'string' || typeof value.value === 'number' ? String(value.value).length : 0,
)
</script>
