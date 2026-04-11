<template>
  <div class="w-full">
    <Listbox v-model="modelValue">
      <Float :placement="upwards ? 'top' : 'bottom'" :offset="8" portal adaptiveWidth class="w-full">
        <ListboxButton
          class="w-full px-4 py-2.5 sm:py-3 flex items-center justify-between rounded-xl !bg-white dark:!bg-gray-800 !border !border-gray-200 dark:!border-gray-700 !shadow-sm hover:!bg-gray-50 dark:hover:!bg-gray-700/50 hover:!border-gray-300 dark:hover:!border-gray-500 text-gray-700 dark:text-gray-200 text-sm font-medium focus:outline-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/30 cursor-pointer transition-all duration-200"
        >
          <span class="flex items-center gap-2">
            <Icon v-if="item.icon" :name="item.icon" class="w-6 h-6 text-gray-500 dark:text-gray-400" />
            <span class="uppercase tracking-wide text-xs font-semibold">{{ item.label || item.value }}</span>
          </span>
          <Icon
            name="mdi:chevron-down"
            class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200"
          />
        </ListboxButton>

        <Transition
          enterActiveClass="transition ease-out duration-150"
          enterFromClass="transform opacity-0 -translate-y-2"
          enterToClass="transform opacity-100 translate-y-0"
          leaveActiveClass="transition ease-in duration-100"
          leaveFromClass="transform opacity-100 translate-y-0"
          leaveToClass="transform opacity-0 -translate-y-2"
        >
          <ListboxOptions
            class="w-full flex flex-col gap-0.5 overflow-hidden rounded-xl !bg-white dark:!bg-gray-800 !border !border-gray-100 dark:!border-gray-700 shadow-xl focus:outline-none z-[9999]"
          >
            <ListboxOption
              v-for="{ label, icon, value } in items"
              v-slot="{ active, selected }"
              :key="value"
              :value="value"
            >
              <button
                type="button"
                class="w-full text-left flex items-center px-3 py-2.5 transition-colors duration-150 rounded-lg !border-none"
                :class="[
                  active ? '!bg-blue-50 dark:!bg-gray-700/60' : '!bg-transparent',
                  selected
                    ? 'font-semibold text-blue-600 dark:text-blue-400'
                    : 'font-medium text-gray-700 dark:text-gray-300',
                ]"
              >
                <Icon
                  v-if="icon"
                  :name="icon"
                  class="w-6 h-6 mr-2"
                  :class="selected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
                />
                <div class="flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <span class="block text-sm">{{ label }}</span>
                    <span
                      v-if="showValue"
                      class="uppercase text-xs"
                      :class="selected ? 'text-blue-500/70 dark:text-blue-400/70' : 'text-gray-400 dark:text-gray-500'"
                    >
                      {{ value }}
                    </span>
                  </div>
                </div>
              </button>
            </ListboxOption>
          </ListboxOptions>
        </Transition>
      </Float>
    </Listbox>
  </div>
</template>

<script setup lang="ts">
import { Float } from '@headlessui-float/vue'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'

export type FormSelectItem = {
  icon?: string
  label?: string
  value: string
}

const {
  items,
  showValue = true,
  upwards = false,
} = defineProps<{
  items: FormSelectItem[]
  showValue?: boolean
  upwards?: boolean
}>()

const modelValue = defineModel<FormSelectItem['value']>({ required: true })

const item = computed(() => items.find((i) => i.value === modelValue.value) || items[0]!)
</script>
