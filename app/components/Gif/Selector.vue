<template>
  <Popover v-slot="{ close }" class="relative">
    <PopoverButton
      class="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ease-out hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-95 dark:hover:bg-white/10 dark:hover:text-blue-400"
      :title="$t('articles.comments.addGif')"
    >
      <Icon
        name="mdi:gif"
        class="h-6 w-6 text-gray-500 transition-colors duration-300 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400"
      />
    </PopoverButton>

    <TransitionRoot
      appear
      enter="transition ease-out duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
      enterFrom="opacity-0 translate-y-2 scale-95"
      enterTo="opacity-100 translate-y-0 scale-100"
      leave="transition ease-in duration-150 cubic-bezier(0.16, 1, 0.3, 1)"
      leaveFrom="opacity-100 translate-y-0 scale-100"
      leaveTo="opacity-0 translate-y-2 scale-95"
      class="origin-bottom-right z-50"
    >
      <PopoverPanel
        static
        focus
        class="absolute bottom-full right-0 z-50 mb-3 w-[28rem] max-w-[95vw] overflow-hidden rounded-2xl border border-gray-100 bg-white/90 p-0 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/5 dark:bg-[#1a1a1a]/90 dark:ring-white/10"
      >
        <div
          v-if="categoriesLoading"
          class="flex h-64 items-center justify-center gap-3 text-sm font-medium text-gray-500 dark:text-neutral-400"
        >
          <Icon name="mdi:loading" class="h-6 w-6 animate-spin text-blue-500" />
          {{ $t('common.loading') }}
        </div>

        <div v-else class="relative flex flex-col">
          <div
            class="flex items-center gap-3 border-b border-gray-100 bg-white/50 p-4 backdrop-blur-sm dark:border-white/5 dark:bg-white/5"
          >
            <Button
              v-if="selectedCategory"
              icon="mdi:arrow-left"
              size="sm"
              variant="neutral"
              borderless
              aria="Zrušit výběr kategorie"
              class="shrink-0 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white"
              @click.stop="clearCategory"
            />
            <div class="relative flex-1">
              <FormInput
                v-model="searchQuery"
                type="text"
                icon="mdi:magnify"
                iconPosition="leading"
                :placeholder="$t('common.search')"
                class="w-full !rounded-xl !border-transparent !bg-gray-100/80 !py-2.5 !text-sm transition-all focus:!bg-white focus:!ring-2 focus:!ring-blue-500/20 dark:!bg-black/20 dark:focus:!bg-black/40 dark:focus:!ring-blue-500/30"
                @input="debouncedSearch"
              />
            </div>
          </div>

          <div class="relative min-h-[300px]">
            <div
              v-show="shouldShowGifs"
              ref="gifContainer"
              class="scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent max-h-[400px] overflow-y-auto p-4 pb-12 transition-all duration-300"
              :class="{ 'opacity-0 translate-y-4': !shouldShowGifs, 'opacity-100 translate-y-0': shouldShowGifs }"
            >
              <div class="grid grid-cols-3 gap-3">
                <button
                  v-for="gif in gifs"
                  :key="gif.id"
                  class="group/gif relative aspect-square overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5 transition-all active:scale-95 dark:bg-white/5 dark:ring-white/5"
                  @click="selectGif(gif, close)"
                >
                  <NuxtImg
                    :src="gif.images.fixed_height.url"
                    :alt="gif.title"
                    class="h-full w-full object-cover transition-transform duration-500 group-hover/gif:scale-110"
                    loading="lazy"
                  />
                  <div
                    class="absolute inset-0 bg-black/0 transition-colors group-hover/gif:bg-black/10 dark:group-hover/gif:bg-white/10"
                  ></div>
                </button>

                <template v-if="gifsLoading">
                  <div
                    v-for="i in 6"
                    :key="'skeleton-' + i"
                    class="aspect-square rounded-xl bg-gray-100 animate-pulse dark:bg-white/5"
                  ></div>
                </template>
              </div>

              <div ref="gifSentinel" class="h-4 w-full"></div>

              <div v-if="error" class="mt-8 flex flex-col items-center gap-4 text-center">
                <div class="rounded-full bg-red-50 p-4 dark:bg-red-500/10">
                  <NuxtImg src="/topik_404_rm.png" alt="Error" class="h-12 w-12 opacity-80" />
                </div>
                <p class="text-sm font-medium text-red-600 dark:text-red-400">{{ $t('common.noResults') }}</p>
              </div>
              <div
                v-else-if="!gifs.length && !gifsLoading"
                class="mt-12 flex flex-col items-center gap-3 text-center text-gray-400 dark:text-neutral-500"
              >
                <Icon name="mdi:emoticon-sad-outline" class="h-10 w-10 opacity-50" />
                <span class="text-sm font-medium">{{ $t('common.noResults') }}</span>
              </div>
            </div>

            <div
              v-show="!shouldShowGifs"
              class="scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent max-h-[400px] overflow-y-auto p-4 pb-12 transition-all duration-300"
              :class="{ 'opacity-0 -translate-y-4': shouldShowGifs, 'opacity-100 translate-y-0': !shouldShowGifs }"
            >
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  v-for="cat in categories"
                  :key="cat.name_encoded"
                  class="group/cat relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-900 shadow-sm transition-all hover:shadow-md active:scale-95 sm:aspect-square"
                  @pointerdown.stop.prevent="selectCategory(cat)"
                >
                  <NuxtImg
                    v-if="cat.gif?.images?.fixed_height?.url"
                    :src="cat.gif.images.fixed_height.url"
                    class="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover/cat:scale-110 group-hover/cat:opacity-50"
                    loading="lazy"
                  />
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 !dark:bg-transparent"
                  >
                    <span
                      class="text-center text-sm font-bold text-white drop-shadow-sm group-hover/cat:scale-105 transition-transform"
                    >
                      {{ cat.name }}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div
              class="absolute bottom-0 right-0 z-10 w-full bg-gradient-to-t from-white via-white/90 to-transparent pb-3 pr-5 pt-8 dark:from-[#1a1a1a] dark:via-[#1a1a1a]/90 pointer-events-none flex justify-end"
            >
              <NuxtImg
                :src="theme.isDark ? '/Poweredby_100px-Black_VertLogo.png' : '/Poweredby_100px-White_VertLogo.png'"
                alt="Powered by Giphy"
                class="h-auto w-14 opacity-60 mix-blend-luminosity grayscale transition-all hover:grayscale-0 hover:opacity-100"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </PopoverPanel>
    </TransitionRoot>
  </Popover>
</template>

<script lang="ts" setup>
import { Popover, PopoverButton, PopoverPanel, TransitionRoot } from '@headlessui/vue'
const theme = useThemeStore()
interface GiphyImage {
  url: string
  width: string
  height: string
}

interface GiphyImages {
  fixed_height: GiphyImage
  original: GiphyImage
}

interface GiphyGif {
  id: string
  title: string
  images: GiphyImages
}

interface GiphyCategory {
  name: string
  name_encoded: string
  gif?: GiphyGif
}

interface GiphyResponse {
  data: GiphyGif[]
  pagination: {
    offset: number
    count: number
    total_count: number
  }
}

interface GiphyCategoriesResponse {
  data: GiphyCategory[]
}

const gifContainer = useTemplateRef('gifContainer')
const gifSentinel = useTemplateRef('gifSentinel')

const gifs = shallowRef<GiphyGif[]>([])
const searchQuery = shallowRef('')
const selectedCategory = shallowRef<GiphyCategory | null>(null)
const hasMore = shallowRef(true)
const error = shallowRef<Error | null>(null)
const categories = shallowRef<GiphyCategory[]>([])

const queryParams = shallowReactive({ page: 1, query: '' })

const emit = defineEmits<{
  (e: 'select', gif: GiphyGif): void
}>()

const shouldShowGifs = computed(() => !!searchQuery.value || !!selectedCategory.value)

const {
  data: categoriesData,
  pending: categoriesLoading,
  execute: fetchCategories,
} = await useFetch<GiphyCategoriesResponse>('/api/gifs?action=list-categories', {
  default: () => ({ data: [] }),
  immediate: false,
})

const {
  data: gifsData,
  pending: gifsLoading,
  refresh: refreshGifs,
} = await useFetch<GiphyResponse>('/api/gifs', {
  query: queryParams,
  default: () => ({ data: [], pagination: { offset: 0, count: 0, total_count: 0 } }),
  watch: false,
})

const getQueryParam = () =>
  searchQuery.value || (selectedCategory.value ? selectedCategory.value.name_encoded : undefined)

watch(categoriesData, (v) => {
  if (v) categories.value = v.data
})

watch(gifsData, (v) => {
  if (v) {
    gifs.value = queryParams.page === 1 ? v.data : [...gifs.value, ...v.data]
    hasMore.value = v.pagination.offset + v.pagination.count < v.pagination.total_count
  }
})

const debouncedSearch = useDebounceFn(() => {
  queryParams.page = 1
  queryParams.query = getQueryParam() || ''
  gifs.value = []
  refreshGifs()
}, 300)

useInfiniteScroll(
  gifSentinel,
  async () => {
    if (!hasMore.value || gifsLoading.value || !shouldShowGifs.value) return
    queryParams.page++
    await refreshGifs()
  },
  { distance: 100, interval: 300 },
)

const selectCategory = (cat: GiphyCategory) => {
  selectedCategory.value = cat
  searchQuery.value = ''
  queryParams.page = 1
  queryParams.query = getQueryParam() || ''
  gifs.value = []
  nextTick(() => {
    gifContainer.value?.focus()
    refreshGifs()
  })
}

const selectGif = (gif: GiphyGif, close: () => void) => {
  emit('select', gif)
  close()
  searchQuery.value = ''
  selectedCategory.value = null
  queryParams.page = 1
  queryParams.query = ''
  gifs.value = []
}

const clearCategory = () => {
  selectedCategory.value = null
  searchQuery.value = ''
  queryParams.page = 1
  queryParams.query = ''
  gifs.value = []
}

onMounted(async () => {
  await fetchCategories()
})

watch(searchQuery, () => {
  selectedCategory.value = null
  queryParams.page = 1
  queryParams.query = getQueryParam() || ''
  gifs.value = []
})
</script>
