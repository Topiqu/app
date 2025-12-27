<template>
  <section class="w-full mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 relative">
    <div
      class="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 px-4 text-xs font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase whitespace-nowrap"
    >
      {{ $t('series.continueReading') }}
    </div>

    <div class="flex flex-col items-center mb-8 relative z-10">
      <h2 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2 text-center max-w-2xl leading-tight">
        {{ series.name }}
      </h2>

      <div class="flex items-center gap-3 mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
        <span>{{ $t('series.part', { count: series.current }) }} / {{ series.total }}</span>
        <div class="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 rounded-full"
            :style="{ width: `${(series.current / series.total) * 100}%` }"
          ></div>
        </div>
      </div>

      <button
        v-if="series.articles && series.articles.length > 0"
        class="group mt-6 flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 active:scale-95"
        @click="toggleList"
      >
        <span
          class="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
        >
          {{ showFullList ? $t('series.hideList') : $t('series.showList') }}
        </span>
        <div
          class="w-5 h-5 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full transition-transform duration-300 ease-out"
          :class="{ 'rotate-180 bg-blue-100 dark:bg-blue-900/30 text-blue-600': showFullList }"
        >
          <Icon name="mdi:chevron-down" class="w-3.5 h-3.5" />
        </div>
      </button>
    </div>

    <div
      class="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="showFullList ? 'grid-rows-[1fr] mb-10' : 'grid-rows-[0fr] mb-0'"
    >
      <div class="overflow-hidden">
        <div
          class="bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 p-2 sm:p-4"
        >
          <ol class="space-y-1">
            <li v-for="art in series.articles" :key="art.id">
              <NuxtLink
                :to="localePath({ name: 'clanky-slug', params: { slug: art.slug } })"
                class="relative flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group"
                :class="[
                  art.slug === route.params.slug
                    ? 'bg-white dark:bg-gray-800 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800/50',
                ]"
              >
                <div class="relative flex-shrink-0">
                  <span
                    class="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors"
                    :class="[
                      art.slug === route.params.slug
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600',
                    ]"
                  >
                    {{ art.seriesOrder }}
                  </span>
                  <span
                    v-if="art.slug === route.params.slug"
                    class="absolute -inset-1 rounded-full bg-blue-500/20 animate-pulse"
                  ></span>
                </div>

                <div class="flex-1 min-w-0">
                  <span
                    class="block text-sm font-semibold truncate transition-colors"
                    :class="[
                      art.slug === route.params.slug
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white',
                    ]"
                  >
                    {{ art.title }}
                  </span>
                  <span
                    v-if="art.slug === route.params.slug"
                    class="text-[10px] font-bold text-blue-500 uppercase tracking-wider"
                  >
                    {{ $t('series.current') }}
                  </span>
                </div>

                <Icon
                  v-if="art.slug !== route.params.slug"
                  name="mdi:chevron-right"
                  class="w-4 h-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300"
                />
              </NuxtLink>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
      <NuxtLink
        v-if="series.prev"
        :to="localePath({ name: 'clanky-slug', params: { slug: series.prev.slug } })"
        class="group relative flex flex-col p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all duration-300"
      >
        <div
          class="flex items-center gap-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
        >
          <Icon
            name="mdi:arrow-left"
            class="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-1"
          />
          {{ $t('series.previous') }}
        </div>

        <div class="flex gap-4 items-start opacity-75 group-hover:opacity-100 transition-opacity">
          <div class="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
            <NuxtImg
              v-if="series.prev.imageUrl"
              :src="series.prev.imageUrl"
              class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
            />
          </div>
          <span class="font-semibold text-gray-600 dark:text-gray-300 leading-snug line-clamp-2">
            {{ series.prev.title }}
          </span>
        </div>
      </NuxtLink>
      <div v-else class="hidden md:block"></div>

      <NuxtLink
        v-if="series.next"
        :to="localePath({ name: 'clanky-slug', params: { slug: series.next.slug } })"
        class="group relative overflow-hidden flex flex-col p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-black/20 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/30 dark:hover:border-blue-500/50 text-right transition-all duration-300"
      >
        <div
          class="absolute inset-0 bg-gradient-to-bl from-blue-50/50 to-transparent dark:from-blue-900/10 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        ></div>

        <div
          class="relative z-10 flex items-center justify-end gap-2 mb-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider"
        >
          {{ $t('series.next') }}
          <Icon
            name="mdi:arrow-right"
            class="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1"
          />
        </div>

        <div class="relative z-10 flex flex-row-reverse gap-5 items-start">
          <div
            class="w-20 h-20 flex-shrink-0 overflow-hidden rounded-xl shadow-sm group-hover:shadow-md transition-shadow"
          >
            <NuxtImg
              v-if="series.next.imageUrl"
              :src="series.next.imageUrl"
              class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
            />
            <div
              v-else
              class="w-full h-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-300"
            >
              <Icon name="mdi:image-outline" class="w-8 h-8" />
            </div>
          </div>
          <div class="flex flex-col">
            <span
              class="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
            >
              {{ series.next.title }}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">
              {{ $t('series.nextPart') }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  series: {
    name: string
    current: number
    total: number
    prev?: { slug: string; title: string; imageUrl?: string | null } | null
    next?: { slug: string; title: string; imageUrl?: string | null } | null
    articles?: Array<{
      id: string
      title: string
      slug: string
      seriesOrder: number
    }>
  }
}>()

const route = useRoute()
const localePath = useLocalePath()
const showFullList = shallowRef(false)

const toggleList = () => (showFullList.value = !showFullList.value)
</script>
