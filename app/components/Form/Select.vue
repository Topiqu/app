<template>
  <div class="w-full">
    <Listbox v-model="modelValue">
      <Float :placement="upwards ? 'top' : 'bottom'" :offset="8" portal adaptiveWidth class="w-full">
        <ListboxButton
          class="w-full px-4 py-2.5 sm:py-3 flex items-center justify-between rounded-xl bg-gray-100! dark:bg-neutral-800! hover:bg-gray-200/70! dark:hover:bg-neutral-700/70! text-gray-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all duration-200 border-none!"
        >
          <span class="flex items-center gap-2">
            <Icon v-if="item.icon" :name="item.icon" class="w-6 h-6" />
            <span class="uppercase tracking-wide text-xs">{{ item.label || item.value }}</span>
          </span>
          <Icon name="mdi:chevron-down" class="w-4 h-4 text-gray-400" />
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
            class="w-full flex flex-col gap-0.5 overflow-hidden rounded-xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-black/30 shadow-lg focus:outline-none z-[9999]"
          >
            <ListboxOption
              v-for="{ label, icon, value } in items"
              v-slot="{ active, selected }"
              :key="value"
              :value="value"
            >
              <button
                type="button"
                class="w-full text-left flex items-center px-3 py-2.5 transition-colors duration-150 rounded-lg border-none!"
                :class="[
                  active ? 'bg-blue-50/70! dark:bg-gray-700!' : 'bg-transparent!',
                  selected ? 'font-semibold' : 'font-normal',
                ]"
              >
                <Icon v-if="icon" :name="icon" class="w-6 h-6 mr-2 text-gray-500 dark:text-gray-400" />
                <div class="flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <span class="block text-sm text-gray-800 dark:text-gray-100">{{ label }}</span>
                    <span v-if="showValue" class="uppercase text-xs text-gray-500 dark:text-gray-400">{{ value }}</span>
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
