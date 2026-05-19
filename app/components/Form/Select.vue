<template>
  <div class="w-full">
    <Listbox v-slot="{ open }" v-model="modelValue">
      <Float :placement="upwards ? 'top' : 'bottom'" :offset="8" portal adaptiveWidth class="w-full">
        <ListboxButton
          class="w-full px-4 py-2.5 sm:py-3 flex items-center justify-between rounded-xl !bg-white dark:!bg-gray-800 !border !border-gray-200 dark:!border-gray-700 !shadow-sm hover:!bg-gray-50 dark:hover:!bg-gray-700/50 hover:!border-gray-300 dark:hover:!border-gray-500 text-gray-700 dark:text-gray-200 text-sm font-medium focus:outline-none focus:!border-indigo-500 focus:!ring-2 focus:!ring-indigo-500/30 cursor-pointer transition-all duration-300 group"
          :class="{ '!border-indigo-500 !ring-2 !ring-indigo-500/30': open }"
        >
          <span class="flex items-center gap-2">
            <Icon
              v-if="item.icon"
              :name="item.icon"
              class="w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors group-hover:text-indigo-500"
              :class="{ 'text-indigo-500': open }"
            />
            <span class="tracking-wide text-sm font-medium text-slate-800 dark:text-slate-200">{{
              item.label || item.value
            }}</span>
          </span>
          <Icon
            name="mdi:chevron-down"
            class="w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            :class="{ 'rotate-180': open }"
          />
        </ListboxButton>

        <Transition
          enterActiveClass="transition duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          enterFromClass="opacity-0 scale-95 -translate-y-2"
          enterToClass="opacity-100 scale-100 translate-y-0"
          leaveActiveClass="transition duration-150 ease-in"
          leaveFromClass="opacity-100 scale-100 translate-y-0"
          leaveToClass="opacity-0 scale-95 -translate-y-2"
        >
          <ListboxOptions
            class="w-full flex flex-col gap-1 p-1 overflow-hidden rounded-xl !bg-white/90 dark:!bg-gray-800/90 backdrop-blur-md !border !border-gray-200/50 dark:!border-gray-700/50 shadow-2xl focus:outline-none z-[9999]"
          >
            <ListboxOption
              v-for="{ label, icon, value } in items"
              v-slot="{ active, selected }"
              :key="value"
              :value="value"
            >
              <button
                type="button"
                class="w-full text-left flex items-center px-3 py-2 transition-all duration-200 rounded-lg !border-none"
                :class="[
                  active ? '!bg-indigo-50 dark:!bg-indigo-500/10' : '!bg-transparent',
                  selected
                    ? 'font-bold text-indigo-700 dark:text-indigo-400'
                    : 'font-medium text-gray-700 dark:text-gray-300',
                ]"
              >
                <Icon
                  v-if="icon"
                  :name="icon"
                  class="w-5 h-5 mr-3 transition-colors duration-200"
                  :class="[
                    selected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500',
                    active && !selected ? 'text-indigo-400' : '',
                  ]"
                />
                <div class="flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <span
                      class="block text-sm"
                      :class="{ 'translate-x-1': active && !selected, 'transition-transform duration-200': true }"
                      >{{ label }}</span
                    >
                    <span
                      v-if="showValue"
                      class="uppercase text-xs font-mono transition-colors duration-200"
                      :class="
                        selected ? 'text-indigo-500/70 dark:text-indigo-400/70' : 'text-gray-400 dark:text-gray-500'
                      "
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
