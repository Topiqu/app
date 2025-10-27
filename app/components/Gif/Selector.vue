<template>
  <Popover v-slot="{ close }" class="relative">
    <PopoverButton
      class="relative group inline-flex items-center justify-center w-10 h-10 rounded-xl cursor-pointer transition-all duration-200 ease-out bg-transparent hover:backdrop-blur-sm hover:bg-gray-300/25 dark:hover:bg-white/10 hover:scale-105 hover:shadow-md dark:hover:shadow-black/40 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 !border-none"
      :title="$t('articles.comments.addGif')"
    >
      <Icon
        name="mdi:gif"
        class="w-6 h-6 text-gray-600 dark:text-gray-300 transition-colors duration-200 group-hover:text-blue-500"
      />
    </PopoverButton>
    <TransitionRoot
      appear
      enter="transition ease-out duration-200 transform"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition ease-in duration-150 transform"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
      class="origin-top-right"
    >
      <PopoverPanel
        static
        focus
        class="absolute bottom-full right-0 z-20 mb-2 w-[26rem] max-w-[95vw] bg-white/95 dark:bg-neutral-800/95 backdrop-blur-[4px] rounded-lg shadow-xl border border-gray-300 dark:border-neutral-600 px-6 py-4"
      >
        <div
          v-if="categoriesLoading"
          class="p-4 text-center text-gray-600 dark:text-neutral-300 text-sm flex items-center justify-center gap-2"
        >
          <Icon name="mdi:loading" class="w-6 h-6 text-blue-500 animate-spin" />
          {{ $t('common.loading') }}
        </div>
        <div v-else class="space-y-4 relative">
          <div class="flex items-center gap-2">
            <Button
              v-if="selectedCategory"
              icon="mdi:arrow-left"
              size="sm"
              variant="neutral"
              borderless
              aria="Zrušit výběr kategorie"
              class="text-gray-500 hover:text-blue-500 dark:text-neutral-300 dark:hover:text-blue-400"
              @click.stop="clearCategory"
            />
            <FormInput
              v-model="searchQuery"
              type="text"
              icon="mdi:magnify"
              iconPosition="leading"
              :placeholder="$t('common.search')"
              class="w-full"
              @input="debouncedSearch"
            />
          </div>
          <div
            v-show="shouldShowGifs"
            ref="gifContainer"
            class="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto transition-opacity duration-200"
            :class="{ 'opacity-0 -translate-y-2': !shouldShowGifs, 'opacity-100 translate-y-0': shouldShowGifs }"
          >
            <button
              v-for="gif in gifs"
              :key="gif.id"
              class="relative aspect-square rounded-lg overflow-hidden shadow-md hover:ring-2 hover:ring-blue-400/60 transition-all duration-300 cursor-pointer"
              @click="selectGif(gif, close)"
            >
              <NuxtImg
                :src="gif.images.fixed_height.url"
                :alt="gif.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
            <div v-if="gifsLoading" class="col-span-3 grid grid-cols-3 gap-4 py-4">
              <div
                v-for="i in 6"
                :key="'skeleton-' + i"
                class="aspect-square rounded-lg bg-gray-200 dark:bg-neutral-700 animate-pulse"
              ></div>
            </div>
            <div ref="gifSentinel" class="h-4 col-span-3"></div>
          </div>
          <div
            v-show="!shouldShowGifs"
            class="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto transition-opacity duration-200"
            :class="{ 'opacity-0 -translate-y-2': shouldShowGifs, 'opacity-100 translate-y-0': !shouldShowGifs }"
          >
            <button
              v-for="cat in categories"
              :key="cat.name_encoded"
              class="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-400/60 transition-transform duration-300 cursor-pointer"
              @pointerdown.stop.prevent="selectCategory(cat)"
            >
              <NuxtImg
                v-if="cat.gif?.images?.fixed_height?.url"
                :src="cat.gif.images.fixed_height.url"
                class="absolute inset-0 w-full h-full object-cover opacity-40"
                loading="lazy"
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-black/20 to-transparent !dark:bg-transparent backdrop-blur-[1px] text-white text-sm font-medium p-4"
              >
                <span class="mr-1 shadow-sm">{{ cat.name }}</span>
                <Icon name="mdi:arrow-right" class="w-4 h-4 hover:text-blue-300 transition-colors" />
              </div>
            </button>
          </div>
          <div
            v-if="shouldShowGifs && error"
            class="p-6 text-center text-red-600 dark:text-red-400 text-sm flex flex-col items-center gap-3"
          >
            <NuxtImg src="/topik_404_rm.png" alt="Error" class="w-20 h-20" />
            {{ $t('common.noResults') }}
          </div>
          <div
            v-else-if="shouldShowGifs && !gifs.length && !gifsLoading"
            class="p-6 text-center text-gray-600 dark:text-neutral-300 text-sm flex flex-col items-center gap-3"
          >
            <Icon name="mdi:emoticon-sad-outline" class="w-8 h-8" />
            {{ $t('common.noResults') }}
          </div>
          <NuxtImg
            :src="theme.isDark ? '/Poweredby_100px-Black_VertLogo.png' : '/Poweredby_100px-White_VertLogo.png'"
            alt="Powered by Giphy"
            class="absolute bottom-3 right-5 w-16 opacity-75 pointer-events-none"
            loading="lazy"
          />
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
