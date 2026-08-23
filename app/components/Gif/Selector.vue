<template>
  <DefinePicker v-slot="{ dismiss }">
    <div
      data-gif-picker
      class="flex w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden"
      :class="isMobile ? 'h-[min(28rem,55dvh)]' : 'h-[min(30rem,calc(44dvh-1rem))]'"
    >
      <div ref="pickerScroll" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="sticky top-0 z-10 space-y-3 border-b border-default bg-default/95 p-4 backdrop-blur">
          <div class="flex items-center gap-2">
            <UButton
              v-if="selectedCategory"
              icon="i-mdi-arrow-left"
              size="sm"
              color="neutral"
              variant="ghost"
              square
              :aria-label="$t('articles.comments.clearGifCategory')"
              @click="clearCategory"
            />
            <UFormField :label="$t('common.search')" :ui="{ label: 'sr-only' }" class="min-w-0 flex-1">
              <UInput
                v-model="searchQuery"
                type="search"
                :placeholder="$t('common.search')"
                icon="i-mdi-magnify"
                class="w-full"
              />
            </UFormField>
          </div>
          <p v-if="selectedCategory" class="truncate text-sm font-semibold text-highlighted">
            {{ selectedCategory.name }}
          </p>
        </div>

        <div v-if="initialLoading" class="grid grid-cols-3 gap-3 p-4" aria-live="polite">
          <USkeleton v-for="i in 9" :key="i" class="aspect-square" />
        </div>

        <UAlert
          v-else-if="initialError"
          class="m-4"
          color="error"
          variant="soft"
          icon="i-mdi-alert-circle-outline"
          :title="$t('common.messages.loadFailedTitle')"
          :description="initialError"
        >
          <template #actions>
            <UButton color="error" variant="soft" icon="i-mdi-refresh" @click="initialize(true)">
              {{ $t('common.messages.retry') }}
            </UButton>
          </template>
        </UAlert>

        <template v-else>
          <section v-if="!searchQuery && !selectedCategory && categories.length" class="border-b border-default p-4">
            <h3 class="mb-3 text-sm font-semibold text-highlighted">{{ $t('articles.comments.gifCategories') }}</h3>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <UButton
                v-for="category in categories"
                :key="category.name_encoded"
                color="neutral"
                variant="ghost"
                class="relative aspect-[4/3] overflow-hidden"
                :aria-label="category.name"
                @click="selectCategory(category)"
              >
                <AppMedia
                  :src="category.gif?.images?.fixed_height?.url"
                  :alt="category.name"
                  :fallbackText="category.name"
                  aspectRatio="4 / 3"
                  sizes="144px"
                  containerClass="absolute inset-0 size-full opacity-40"
                />
                <span class="relative z-[1] line-clamp-2 text-sm font-bold text-highlighted">{{ category.name }}</span>
              </UButton>
            </div>
          </section>

          <section class="p-4" :aria-labelledby="`${pickerId}-results`">
            <h3 :id="`${pickerId}-results`" class="mb-3 text-sm font-semibold text-highlighted">
              {{
                searchQuery || selectedCategory
                  ? $t('articles.comments.gifResults')
                  : $t('articles.comments.trendingGifs')
              }}
            </h3>
            <div v-if="gifs.length" class="grid grid-cols-3 gap-3">
              <UButton
                v-for="gif in gifs"
                :key="gif.id"
                color="neutral"
                variant="ghost"
                square
                :ui="{ base: 'aspect-square size-auto overflow-hidden p-0' }"
                :aria-label="gif.title || $t('articles.comments.addGif')"
                :title="gif.title"
                @click="selectGif(gif, dismiss)"
              >
                <AppMedia
                  :src="gif.images.fixed_height.url"
                  :originalSrc="gif.images.original.url"
                  :alt="gif.title || $t('articles.comments.addGif')"
                  aspectRatio="1 / 1"
                  sizes="144px"
                  containerClass="size-full"
                />
              </UButton>
              <USkeleton v-for="i in loadingMore ? 3 : 0" :key="`more-${i}`" class="aspect-square" />
            </div>
            <UEmpty v-else-if="!gifsLoading" icon="i-mdi-emoticon-sad-outline" :title="$t('common.noResults')" />
            <div ref="gifSentinel" class="h-1" aria-hidden="true" />
            <div v-if="gifsError" class="mt-3 text-center">
              <UAlert color="error" variant="soft" :title="gifsError">
                <template #actions>
                  <UButton color="error" variant="soft" icon="i-mdi-refresh" @click="loadGifs(false)">
                    {{ $t('common.messages.retry') }}
                  </UButton>
                </template>
              </UAlert>
            </div>
            <div v-else-if="hasMore && gifs.length" class="mt-4 text-center">
              <UButton color="neutral" variant="soft" :loading="loadingMore" @click="loadMore">
                {{ $t('common.pagination.next') }}
              </UButton>
            </div>
          </section>
        </template>
      </div>

      <div class="pointer-events-none flex shrink-0 justify-end border-t border-default bg-default px-4 py-2">
        <AppMedia
          :src="theme.isDark ? '/Poweredby_100px-White_VertLogo.png' : '/Poweredby_100px-Black_VertLogo.png'"
          alt="Powered by Giphy"
          aspectRatio="100 / 27"
          fit="contain"
          sizes="100px"
          containerClass="h-7 w-[6.5rem] bg-transparent"
        />
      </div>
    </div>
  </DefinePicker>

  <UDrawer
    v-if="isMobile"
    v-model:open="pickerOpen"
    :title="$t('articles.comments.addGif')"
    :ui="{
      content: 'h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden',
      body: 'min-h-0 flex-1 overflow-hidden',
    }"
  >
    <UButton
      ref="trigger"
      color="neutral"
      variant="ghost"
      square
      icon="i-mdi-gif"
      :aria-label="$t('articles.comments.addGif')"
    />
    <template #body><ReusePicker :dismiss="closePicker" /></template>
  </UDrawer>

  <UPopover
    v-else
    v-model:open="pickerOpen"
    :content="{ side: 'top', align: 'end', sideOffset: 12, collisionPadding: 16 }"
  >
    <UButton
      ref="trigger"
      color="neutral"
      variant="ghost"
      square
      icon="i-mdi-gif"
      :aria-label="$t('articles.comments.addGif')"
    />
    <template #content="{ close }"><ReusePicker :dismiss="close" /></template>
  </UPopover>
</template>

<script setup lang="ts">
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
  pagination: { offset: number; count: number; total_count: number }
}

const emit = defineEmits<{ select: [gif: GiphyGif] }>()
const theme = useThemeStore()
const isMobile = useMediaQuery('(max-width: 639px)')
const pickerOpen = shallowRef(false)
const pickerId = useId()
const trigger = useTemplateRef<{ $el?: HTMLElement }>('trigger')
const [DefinePicker, ReusePicker] = createReusableTemplate<{ dismiss: unknown }>()
const gifSentinel = useTemplateRef<HTMLElement>('gifSentinel')

const categories = shallowRef<GiphyCategory[]>([])
const gifs = shallowRef<GiphyGif[]>([])
const searchQuery = shallowRef('')
const selectedCategory = shallowRef<GiphyCategory | null>(null)
const initialized = shallowRef(false)
const categoriesLoading = shallowRef(false)
const gifsLoading = shallowRef(false)
const loadingMore = shallowRef(false)
const categoriesError = shallowRef('')
const gifsError = shallowRef('')
const page = shallowRef(1)
const hasMore = shallowRef(true)
let requestVersion = 0
let suppressSearchWatch = false

const initialLoading = computed(() => !initialized.value && (categoriesLoading.value || gifsLoading.value))
const initialError = computed(() => (!initialized.value ? categoriesError.value || gifsError.value : ''))
const activeQuery = computed(() => searchQuery.value.trim() || selectedCategory.value?.name_encoded || '')
const errorMessage = (error: unknown) =>
  (error as { data?: { message?: string }; message?: string })?.data?.message ||
  (error as { message?: string })?.message ||
  $t('common.messages.loadFailedText')

const loadCategories = async () => {
  categoriesLoading.value = true
  categoriesError.value = ''
  try {
    const response = await $fetch<{ data: GiphyCategory[] }>('/api/gifs', {
      query: { action: 'list-categories' },
      retry: 0,
    })
    categories.value = response.data
  } catch (error) {
    categoriesError.value = errorMessage(error)
  } finally {
    categoriesLoading.value = false
  }
}

const loadGifs = async (append: boolean) => {
  const version = ++requestVersion
  gifsError.value = ''
  if (append) loadingMore.value = true
  else gifsLoading.value = true
  try {
    const response = await $fetch<GiphyResponse>('/api/gifs', {
      query: { page: page.value, limit: 18, ...(activeQuery.value ? { query: activeQuery.value } : {}) },
      retry: 0,
    })
    if (version !== requestVersion) return
    gifs.value = append ? [...gifs.value, ...response.data] : response.data
    hasMore.value = response.pagination.offset + response.pagination.count < response.pagination.total_count
  } catch (error) {
    if (version === requestVersion) gifsError.value = errorMessage(error)
  } finally {
    if (version === requestVersion) {
      gifsLoading.value = false
      loadingMore.value = false
    }
  }
}

const initialize = async (force = false) => {
  if (initialized.value && !force) return
  categoriesError.value = ''
  gifsError.value = ''
  page.value = 1
  await Promise.all([loadCategories(), loadGifs(false)])
  initialized.value = !categoriesError.value && !gifsError.value
}

watch(pickerOpen, async (open, wasOpen) => {
  if (open) initialize()
  else if (wasOpen) {
    await nextTick()
    trigger.value?.$el?.focus()
  }
})

const runSearch = useDebounceFn(async () => {
  page.value = 1
  gifs.value = []
  await loadGifs(false)
}, 300)
watch(searchQuery, () => {
  if (suppressSearchWatch) return
  selectedCategory.value = null
  runSearch()
})

const selectCategory = async (category: GiphyCategory) => {
  suppressSearchWatch = true
  searchQuery.value = ''
  selectedCategory.value = category
  await nextTick()
  suppressSearchWatch = false
  page.value = 1
  gifs.value = []
  await loadGifs(false)
}

const clearCategory = async () => {
  selectedCategory.value = null
  page.value = 1
  gifs.value = []
  await loadGifs(false)
}

const loadMore = async () => {
  if (!hasMore.value || gifsLoading.value || loadingMore.value) return
  page.value += 1
  await loadGifs(true)
}

useInfiniteScroll(gifSentinel, loadMore, { distance: 120, interval: 300 })

const closePicker = () => {
  pickerOpen.value = false
}
const selectGif = (gif: GiphyGif, dismiss: unknown) => {
  emit('select', gif)
  if (typeof dismiss === 'function') dismiss()
  else closePicker()
}
</script>
