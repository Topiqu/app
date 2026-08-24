<template>
  <section class="mt-12 w-full">
    <USeparator :label="$t('series.continueReading')" />

    <div class="mt-6 flex flex-col items-center gap-4">
      <h2 class="max-w-2xl text-center text-2xl font-bold text-highlighted md:text-3xl">{{ series.name }}</h2>
      <div class="flex w-full max-w-sm items-center gap-3 text-sm text-muted">
        <span>{{ $t('series.part', { count: series.current }) }} / {{ series.total }}</span>
        <UProgress :modelValue="(series.current / series.total) * 100" class="flex-1" />
      </div>
    </div>

    <UCollapsible v-if="series.articles?.length" v-model:open="showFullList" class="mt-6 w-full">
      <UButton
        color="neutral"
        variant="soft"
        :label="showFullList ? $t('series.hideList') : $t('series.showList')"
        :trailingIcon="showFullList ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'"
      />

      <template #content>
        <UCard class="mt-4">
          <div class="flex flex-col gap-2">
            <UPageCard
              v-for="art in series.articles"
              :key="art.id"
              :to="localePath({ name: 'clanky-slug', params: { slug: art.slug } })"
              :title="art.title"
              variant="subtle"
              :ui="{ wrapper: 'flex-row items-center gap-3', leading: 'mb-0' }"
            >
              <template #leading>
                <AppMedia
                  :src="art.imageUrl"
                  alt=""
                  aspectRatio="4 / 3"
                  sizes="64px"
                  containerClass="size-16 shrink-0 rounded-md"
                />
              </template>
              <template #description>
                <UBadge v-if="art.slug === currentSlug" color="primary" variant="soft" size="sm">
                  {{ $t('series.current') }}
                </UBadge>
                <span v-else class="text-sm text-muted">{{ art.seriesOrder }} / {{ series.total }}</span>
              </template>
            </UPageCard>
          </div>
        </UCard>
      </template>
    </UCollapsible>

    <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
      <UPageCard
        v-if="series.prev"
        :to="localePath({ name: 'clanky-slug', params: { slug: series.prev.slug } })"
        :title="series.prev.title"
        icon="i-mdi-arrow-left"
        variant="subtle"
      >
        <template #header>
          <AppMedia
            :src="series.prev.imageUrl"
            alt=""
            aspectRatio="16 / 9"
            sizes="100vw md:50vw"
            containerClass="w-full rounded-md"
          />
        </template>
        <template #description>
          <p class="text-xs font-medium text-muted">{{ $t('series.previous') }}</p>
          <p v-if="series.prev.excerpt" class="mt-1 line-clamp-2 text-sm text-toned">
            {{ series.prev.excerpt }}
          </p>
        </template>
      </UPageCard>
      <div v-else class="hidden md:block" />
      <UPageCard
        v-if="series.next"
        :to="localePath({ name: 'clanky-slug', params: { slug: series.next.slug } })"
        :title="series.next.title"
        icon="i-mdi-arrow-right"
        variant="outline"
      >
        <template #header>
          <AppMedia
            :src="series.next.imageUrl"
            alt=""
            aspectRatio="16 / 9"
            sizes="100vw md:50vw"
            containerClass="w-full rounded-md"
          />
        </template>
        <template #description>
          <p class="text-xs font-medium text-muted">{{ $t('series.nextPart') }}</p>
          <p v-if="series.next.excerpt" class="mt-1 line-clamp-2 text-sm text-toned">
            {{ series.next.excerpt }}
          </p>
        </template>
      </UPageCard>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  series: {
    name: string
    current: number
    total: number
    prev?: { slug: string; title: string; excerpt?: string | null; imageUrl?: string | null } | null
    next?: { slug: string; title: string; excerpt?: string | null; imageUrl?: string | null } | null
    articles?: Array<{
      id: string
      title: string
      slug: string
      seriesOrder: number
      imageUrl?: string | null
    }>
  }
}>()

const route = useRoute()
const localePath = useLocalePath()
const showFullList = shallowRef(false)
const currentSlug = computed(() => String(route.params.slug || ''))

const series = computed(() => props.series)
</script>
