<template>
  <div class="flex flex-col gap-2 w-full">
    <span class="text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400 ml-1">
      {{ $t('series.label') }}
    </span>

    <Dropdown :groups="dropdownGroups" class="w-full">
      <template #default="{ open }">
        <button
          type="button"
          class="relative w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-200 ease-in-out bg-white dark:bg-neutral-900 border rounded-xl shadow-sm outline-none group"
          :class="[
            open
              ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-500/10'
              : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-50/50 dark:hover:bg-neutral-800/50',
          ]"
        >
          <span
            class="truncate text-sm font-medium transition-colors"
            :class="modelValue ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
          >
            {{ modelValue ? modelValue.name : $t('series.placeholder') }}
          </span>

          <Icon
            name="mdi:chevron-down"
            class="w-5 h-5 text-gray-400 transition-transform duration-300 ease-out flex-shrink-0"
            :class="[open ? 'rotate-180 text-indigo-500' : 'group-hover:text-gray-600 dark:group-hover:text-gray-300']"
          />
        </button>
      </template>
    </Dropdown>

    <transition
      enterActiveClass="transition duration-200 ease-out"
      enterFromClass="opacity-0 -translate-y-2"
      enterToClass="opacity-100 translate-y-0"
      leaveActiveClass="transition duration-150 ease-in"
      leaveFromClass="opacity-100 translate-y-0"
      leaveToClass="opacity-0 -translate-y-2"
    >
      <div
        v-if="modelValue"
        class="mt-1 group flex items-center justify-between p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 backdrop-blur-sm"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 flex-shrink-0"
          >
            <Icon name="mdi:playlist-play" class="w-5 h-5" />
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {{ modelValue.name }}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {{ $t('series.part', { count: (modelValue.articles?.length ?? 0) + 1 }, '{count}. díl') }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="p-2 rounded-lg text-gray-400 transition-all duration-200 hover:bg-white dark:hover:bg-neutral-800 hover:text-red-500 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
          :title="$t('common.actions.delete')"
          @click="modelValue = null"
        >
          <Icon name="mdi:close" class="w-4 h-4" />
        </button>
      </div>
    </transition>

    <ModalMini v-model:open="createModal" :title="$t('series.createTitle', 'Vytvořit novou sérii')">
      <template #content>
        <div class="flex flex-col gap-4 py-2">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
              {{ $t('series.nameLabel') }}
            </span>
            <FormInput
              v-model="newSeriesName"
              class="w-full"
              :placeholder="$t('series.namePlaceholder', 'Např. Úvod do Vue 3...')"
              autofocus
              @keyup.enter="createAndSelect"
            />
          </label>
        </div>
      </template>

      <template #actions>
        <Button size="sm" variant="primary" icon="mdi:check" :disabled="!newSeriesName.trim()" @click="createAndSelect">
          {{ $t('common.create') }}
        </Button>
      </template>
    </ModalMini>
  </div>
</template>

<script setup lang="ts">
import slugify from 'slugify'

const modelValue = defineModel<any>({ default: null })

const { data: series, refresh } = await useLazyFetch<any[]>('/api/series', {
  server: false,
  default: () => [],
})

const createModal = shallowRef(false)
const newSeriesName = shallowRef('')

const seriesItems = computed(() =>
  series.value.map((s) => ({
    id: s.id,
    label: s.name,
    icon: 'mdi:bookmark-outline',
    onClick: () => (modelValue.value = s),
  })),
)

const createItem = computed(() => ({
  id: 'create',
  label: $t('series.createNew', 'Vytvořit novou sérii...'),
  icon: 'mdi:plus-circle-outline',
  href: undefined,
  onClick: () => (createModal.value = true),
}))

const dropdownGroups = computed(() => [seriesItems.value, [createItem.value]])

const createAndSelect = async () => {
  if (!newSeriesName.value.trim()) return

  try {
    const newSeries = await $fetch('/api/series', {
      method: 'POST',
      body: {
        name: newSeriesName.value.trim(),
        slug: slugify(newSeriesName.value.trim(), { lower: true, strict: true }),
      },
    })
    await refresh()
    modelValue.value = newSeries
    createModal.value = false
    newSeriesName.value = ''
  } catch {
    useToast().error({ message: $t('series.createFailed') })
  }
}
</script>
