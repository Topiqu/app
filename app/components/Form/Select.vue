<template>
  <Listbox v-model="modelValue">
    <div class="relative">
      <ListboxButton
        class="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-lg bg-[#f9fafb] dark:bg-neutral-700 text-gray-800 dark:text-white text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer input transition"
      >
        <span class="flex items-center gap-2">
          <Icon v-if="item.icon" :name="item.icon" class="w-6 h-6" />
          <span class="uppercase tracking-wide text-xs">{{ item.label || item.value }}</span>
        </span>
        <Icon name="mdi:chevron-down" class="w-4 h-4 text-gray-400" />
      </ListboxButton>
      <Transition
        enterActiveClass="transition ease-out duration-150"
        enterFromClass="transform opacity-0 scale-95"
        enterToClass="transform opacity-100 scale-100"
        leaveActiveClass="transition ease-in duration-100"
        leaveFromClass="transform opacity-100 scale-100"
        leaveToClass="transform opacity-0 scale-95"
      >
        <ListboxOptions
          class="mt-2 w-full flex flex-col gap-0.5 absolute right-0 overflow-hidden rounded-xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-black/30 shadow-lg focus:outline-none z-50"
        >
          <ListboxOption v-for="{ label, icon, value } in items" v-slot="{ active, selected }" :key="value" :value>
            <Button
              class="w-full text-left bg-transparent border-none!"
              variant="neutral"
              :class="[{ 'bg-blue-50 dark:bg-gray-700': active }, selected ? 'font-semibold' : 'font-normal']"
            >
              <Icon v-if="icon" :name="icon" class="w-7 h-7 mr-1" />
              <div class="flex-1">
                <div class="flex is-center justify-between">
                  <span class="block text-sm text-gray-800 dark:text-gray-100">{{ label }}</span>
                  <span class="uppercase text-xs text-gray-500 dark:text-gray-400">{{ value }}</span>
                </div>
              </div>
            </Button>
          </ListboxOption>
        </ListboxOptions>
      </Transition>
    </div>
  </Listbox>
</template>

<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'

export type FormSelectItem = {
  icon?: string
  label?: string
  value: string
}

const { items } = defineProps<{ items: FormSelectItem[] }>()

const modelValue = defineModel<FormSelectItem['value']>({ required: true })

const item = computed(() => items.find((i) => i.value === modelValue.value) || items[0]!)
</script>
