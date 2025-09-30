<template>
  <div class="relative inline-block">
    <Listbox v-model="internalLocale" @update:modelValue="handleChange">
      <div class="relative">
        <ListboxButton
          class="w-full px-3 sm:px-4 py-2 sm:py-3 inline-flex items-center gap-3 rounded-lg px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 ring-1 ring-gray-200 dark:ring-gray-700 shadow-sm backdrop-blur-sm text-sm font-medium text-gray-700 dark:text-gray-100 border border-gray-300 dark:border-neutral-600 shadow-sm transition"
        >
          <span class="flex items-center gap-2">
            <Icon :name="currentIcon!" class="w-6 h-6" />
            <span class="uppercase tracking-wide text-xs">{{ currentCode }}</span>
          </span>
          <ChevronDown class="w-4 h-4 text-gray-400" />
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
            class="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-black/30 shadow-lg focus:outline-none z-50"
          >
            <div class="py-1">
              <ListboxOption
                v-for="lang in availableLocales"
                :key="lang.code"
                v-slot="{ active, selected }"
                :value="lang.code"
              >
                <button
                  class="w-full text-left flex items-center gap-3 px-3 py-2 text-sm transition"
                  :class="[active ? 'bg-blue-50 dark:bg-gray-700' : '', selected ? 'font-semibold' : 'font-normal']"
                >
                  <Icon :name="lang.icon" class="w-7 h-7" />
                  <div class="flex-1">
                    <div class="flex items-center justify-between">
                      <span class="block text-sm text-gray-800 dark:text-gray-100">{{ lang.name }}</span>
                      <span class="uppercase text-xs text-gray-500 dark:text-gray-400">{{ lang.code }}</span>
                    </div>
                    <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ lang.note }}</div>
                  </div>
                </button>
              </ListboxOption>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue'

const props = defineProps<{ language: 'cs' | 'en' }>()
const emit = defineEmits<{ (e: 'update:language', value: 'cs' | 'en'): void }>()

const availableLocales = [
  { code: 'cs', name: 'Čeština', icon: 'twemoji:flag-czechia', note: 'Czech' },
  { code: 'en', name: 'English', icon: 'twemoji:flag-united-kingdom', note: 'English' },
]

const internalLocale = shallowRef<'cs' | 'en'>(props.language)

const current = computed(() => availableLocales.find((l) => l.code === internalLocale.value) ?? availableLocales[0])
const currentIcon = computed(() => current.value?.icon)
const currentCode = computed(() => current.value?.code.toUpperCase())

function handleChange(newLocale: 'cs' | 'en') {
  emit('update:language', newLocale)
}
</script>
