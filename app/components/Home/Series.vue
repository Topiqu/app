<template>
  <section v-if="series?.length" class="space-y-6" aria-labelledby="series-shelf-title">
    <h2 id="series-shelf-title" class="text-3xl font-bold tracking-tight text-highlighted">
      {{ $t('articles.home.series') }}
    </h2>
    <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="item in series" :key="item.id">
        <UCard class="relative h-full" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
          <AppMedia
            :src="item.imageUrl"
            :alt="item.name"
            :fallbackText="item.name"
            :fallbackBorder="false"
            aspectRatio="16 / 9"
            sizes="100vw sm:50vw lg:33vw"
            containerClass="w-full"
          />
          <div class="flex flex-1 flex-col gap-3 p-5">
            <UBadge color="primary" variant="soft" icon="mdi:bookshelf" class="self-start">
              {{ $t('series.parts', item.total) }}
            </UBadge>
            <h3 class="text-balance text-xl font-bold leading-tight text-highlighted">
              <NuxtLink :to="partPath(item.next ?? item.first)" class="after:absolute after:inset-0">
                {{ item.name }}
              </NuxtLink>
            </h3>
            <p v-if="item.description" class="line-clamp-2 text-sm text-muted">{{ item.description }}</p>
            <div class="mt-auto space-y-2 pt-2">
              <template v-if="item.read">
                <p class="text-xs text-muted">{{ $t('series.readOf', { read: item.read, total: item.total }) }}</p>
                <UProgress :modelValue="item.read" :max="item.total" size="sm" />
              </template>
              <p class="flex items-center gap-1 text-sm font-semibold text-primary">
                <UIcon
                  :name="item.next ? 'mdi:arrow-right' : 'mdi:check-circle-outline'"
                  size="18"
                  aria-hidden="true"
                />
                <span v-if="!item.next">{{ $t('series.finished') }}</span>
                <span v-else-if="item.read" class="truncate">
                  {{ $t('series.continueWith', { title: item.next.title }) }}
                </span>
                <span v-else>{{ $t('series.start') }}</span>
              </p>
            </div>
          </div>
        </UCard>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { Language } from '~~/shared/utils/language'

const { site } = defineProps<{ site: string }>()

const localePath = useLocalePath()
const { locale } = useI18n()

const { data: series } = await useLazyFetch(`/api/series/by-clientsite/${site}`, { query: { locale } })

const partPath = (part: { slug: string; language?: Language | null }) =>
  localePath({ name: 'clanky-slug', params: { slug: part.slug } }, part.language ?? undefined)
</script>
