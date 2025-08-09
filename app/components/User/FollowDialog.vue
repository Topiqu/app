<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" />
    </TransitionChild>
    <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-150"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <DialogPanel
          class="w-full max-w-2xl p-8 sm:p-10 rounded-3xl shadow-2xl border flex flex-col max-h-[80vh] overflow-hidden bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
        >
          <div class="flex items-center justify-between mb-6">
            <DialogTitle class="text-2xl font-semibold">
              {{ type === 'followers' ? 'Sledující' : 'Sledování' }}
            </DialogTitle>
            <button
              class="p-2 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zavřít"
              @click="$emit('close')"
            >
              <Icon name="mdi:close" class="w-6 h-6" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto pr-2 sm:pr-4">
            <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">Načítání...</div>
            <div v-else-if="error" class="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p class="text-red-600 dark:text-red-400">{{ error?.message || 'Chyba při načítání' }}</p>
            </div>
            <div v-else-if="!data?.length" class="text-center text-gray-500 dark:text-gray-400 py-8">
              Žádní {{ type === 'followers' ? 'sledující' : 'uživatelé nejsou sledováni' }}.
            </div>
            <div v-else class="grid gap-4">
              <div
                v-for="u in data"
                :key="u.id"
                class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-900"
              >
                <NuxtImg
                  v-if="u.avatarUrl"
                  :src="u.avatarUrl"
                  :alt="`Avatar ${u.username}`"
                  format="webp"
                  quality="80"
                  width="40"
                  height="40"
                  class="w-10 h-10 rounded-full object-cover"
                />
                <Icon v-else name="mdi:account-circle-outline" class="w-10 h-10 text-gray-400 dark:text-gray-600" />
                <div>
                  <NuxtLink
                    :to="`/autor/${u.username}`"
                    class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {{ u.username }}
                  </NuxtLink>
                  <p v-if="u.bio" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ u.bio }}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script lang="ts" setup>
import { Dialog, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/vue'

const props = defineProps<{
  type: 'followers' | 'followed'
}>()
defineEmits(['close'])

const { data, pending, error } = useFetch(`/api/follows/${props.type}`, {
  key: `follow-${props.type}`,
  watch: [() => props.type],
})
</script>
