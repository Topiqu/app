<template>
  <Popover v-slot="{ close }" class="relative">
    <PopoverButton
      class="flex items-center gap-1 p-2 text-gray-500 hover:text-blue-500 rounded-xl hover:bg-gray-100 transition-colors"
      :title="$t('articles.comments.addGif')"
    >
      <Icon name="mdi:gif" class="w-6 h-6" />
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
        class="absolute bottom-full right-0 z-20 mb-2 w-96 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4"
        @mousedown.stop
        @click.stop
      >
        <div
          v-if="categoriesLoading"
          class="p-4 text-center text-gray-600 text-sm flex items-center justify-center gap-2"
        >
          <Icon name="mdi:loading" class="w-6 h-6 text-blue-500 animate-spin" />
          {{ $t('common.loading') }}
        </div>
        <div v-else class="space-y-4">
          <div class="flex items-center gap-2">
            <Button
              v-if="selectedCategory"
              icon="mdi:arrow-left"
              size="sm"
              variant="neutral"
              borderless
              aria="Zrušit výběr kategorie"
              @click.stop="clearCategory"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('articles.comments.searchGif')"
              class="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              @input="debouncedSearch"
            />
          </div>
          <div v-show="shouldShowGifs" ref="gifContainer" class="grid grid-cols-3 gap-3 mt-4 max-h-96 overflow-y-auto">
            <button
              v-for="gif in gifs"
              :key="gif.id"
              class="relative aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
              @click="selectGif(gif, close)"
            >
              <NuxtImg
                :src="gif.images.fixed_height.url"
                :alt="gif.title"
                class="w-full h-full object-cover"
                loading="lazy"
                format="webp"
                quality="80"
              />
            </button>
            <div v-if="loading" class="col-span-3 grid grid-cols-3 gap-3 py-4">
              <div
                v-for="i in 6"
                :key="'skeleton-' + i"
                class="aspect-square rounded-xl bg-gray-200 animate-pulse"
              ></div>
            </div>
            <div ref="gifSentinel" class="h-4 col-span-3"></div>
          </div>
          <div v-show="!shouldShowGifs" class="grid grid-cols-3 gap-3 mt-4 max-h-96 overflow-y-auto">
            <button
              v-for="cat in categories"
              :key="cat.name_encoded"
              class="relative aspect-square rounded-xl overflow-hidden hover:scale-105 transition-transform duration-200 cursor-pointer"
              @pointerdown.stop.prevent="selectCategory(cat)"
            >
              <NuxtImg
                v-if="cat.gif?.images?.fixed_height?.url"
                :src="cat.gif.images.fixed_height.url"
                class="absolute inset-0 w-full h-full object-cover opacity-30"
                loading="lazy"
                format="webp"
                quality="80"
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900/30 to-transparent backdrop-blur-sm text-white text-sm"
              >
                <span class="mr-1">{{ cat.name }}</span>
                <Icon name="mdi:arrow-right" class="w-4 h-4 hover:text-blue-300 transition-colors" />
              </div>
            </button>
          </div>
          <div
            v-if="shouldShowGifs && error"
            class="p-4 text-center text-red-600 text-sm flex flex-col items-center gap-2"
          >
            <NuxtImg src="/topik_404_rm.png" alt="Error" class="w-16 h-16" />
            {{ $t('articles.comments.errorLoadingGifs') }}
          </div>
          <div
            v-else-if="shouldShowGifs && !gifs.length && !loading"
            class="p-4 text-center text-gray-600 text-sm flex flex-col items-center gap-2"
          >
            <Icon name="mdi:emoticon-sad-outline" class="w-6 h-6" />
            {{ $t('articles.comments.noGifs') }}
          </div>
        </div>
      </PopoverPanel>
    </TransitionRoot>
  </Popover>
</template>

<script lang="ts" setup>
import { Popover, PopoverButton, PopoverPanel, TransitionRoot } from '@headlessui/vue'

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

const toast = useToast()
const gifContainer = useTemplateRef('gifContainer')
const gifSentinel = useTemplateRef('gifSentinel')

const gifs = shallowRef<GiphyGif[]>([])
const searchQuery = shallowRef('')
const selectedCategory = shallowRef<GiphyCategory | null>(null)
const page = shallowRef(1)
const hasMore = shallowRef(true)
const loading = shallowRef(false)
const error = shallowRef<Error | null>(null)
const categories = shallowRef<GiphyCategory[]>([])

const emit = defineEmits<{
  (e: 'select', gif: GiphyGif): void
}>()

const shouldShowGifs = computed(() => !!searchQuery.value || !!selectedCategory.value)

const {
  data: categoriesData,
  pending: categoriesLoading,
  error: categoriesError,
  execute: fetchCategories,
} = await useFetch<GiphyCategoriesResponse>('/api/gifs?action=list-categories', {
  default: () => ({ data: [] }),
  immediate: false,
})

watch(categoriesData, (v) => {
  if (v) categories.value = v.data
})
watch(categoriesError, (e) => {
  if (e) toast.error({ message: $t('articles.comments.errorLoadingCategories') })
})

const getQueryParam = () =>
  searchQuery.value || (selectedCategory.value ? selectedCategory.value.name_encoded : undefined)

const fetchGifs = async () => {
  if (loading.value || !hasMore.value || !shouldShowGifs.value) return
  loading.value = true
  try {
    const queryParam = getQueryParam()
    const res = await $fetch<GiphyResponse>('/api/gifs', {
      query: { page: page.value, ...(queryParam && { query: queryParam }) },
    })
    gifs.value = page.value === 1 ? res.data : [...gifs.value, ...res.data]
    hasMore.value = res.pagination.offset + res.pagination.count < res.pagination.total_count
    error.value = null
  } catch (e: any) {
    error.value = e
    toast.error({ message: $t('articles.comments.errorLoadingGifs') })
  } finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  gifs.value = []
  fetchGifs()
}, 300)

useInfiniteScroll(
  gifSentinel,
  async () => {
    if (!hasMore.value || loading.value || !shouldShowGifs.value) return
    page.value++
    await fetchGifs()
  },
  { distance: 100, interval: 300 },
)

const selectCategory = (cat: GiphyCategory) => {
  selectedCategory.value = cat
  searchQuery.value = ''
  page.value = 1
  gifs.value = []
  nextTick(() => {
    gifContainer.value?.focus()
    fetchGifs()
  })
}

const selectGif = (gif: GiphyGif, close: () => void) => {
  emit('select', gif)
  close()
  searchQuery.value = ''
  selectedCategory.value = null
  page.value = 1
  gifs.value = []
}

const clearCategory = () => {
  selectedCategory.value = null
  searchQuery.value = ''
  page.value = 1
  gifs.value = []
}

onMounted(async () => {
  await fetchCategories()
})

watch(searchQuery, () => {
  selectedCategory.value = null
  page.value = 1
  gifs.value = []
})
</script>
