<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div>
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('backlinks.links.title') }}</h2>
      <p v-if="links.length" class="mt-1 text-sm text-muted">{{ $t('backlinks.links.description') }}</p>
    </div>

    <p
      v-if="!links.length"
      class="flex items-center gap-2 rounded-(--topiqu-surface-radius) border border-dashed border-default px-4 py-3 text-sm text-muted"
    >
      <UIcon name="mdi:link-variant-off" class="size-4 shrink-0" aria-hidden="true" />
      {{ $t('backlinks.links.empty') }}
    </p>
    <ul
      v-else
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <li v-for="link in links" :key="link.id" class="flex items-center gap-3 px-4 py-3">
        <div class="min-w-0 flex-1">
          <a
            :href="link.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="block truncate text-sm font-medium text-highlighted hover:underline"
          >
            {{ link.sourceDomain }}
          </a>
          <p class="truncate text-xs text-muted">
            {{ link.anchor ? $t('backlinks.links.anchor', { anchor: link.anchor }) : link.targetUrl }}
          </p>
          <p class="text-xs text-muted">
            {{
              link.lostAt
                ? $t('backlinks.links.lostOn', { date: formatDate(link.lostAt) })
                : $t('backlinks.links.since', { date: formatDate(link.firstSeenAt) })
            }}
          </p>
        </div>
        <UBadge v-if="link.opportunityId" size="sm" variant="subtle" color="primary">
          {{ $t('backlinks.links.earned') }}
        </UBadge>
        <UBadge size="sm" variant="soft" :color="link.lostAt ? 'error' : isFollowed(link.rel) ? 'success' : 'neutral'">
          {{
            link.lostAt
              ? $t('backlinks.links.lost')
              : isFollowed(link.rel)
                ? $t('backlinks.links.followed')
                : $t('backlinks.links.nofollow')
          }}
        </UBadge>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { isFollowed } from '~~/shared/utils/backlinks'

const { locale } = useI18n()
const headingId = useId()

const { data } = useBacklinks()
const links = computed(() => data.value?.links ?? [])

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
</script>
