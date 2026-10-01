<script setup lang="ts">
import type { VisibilityOverview } from '~/types/visibility'
defineProps<{ referrals: VisibilityOverview['referrals']; crawlers: VisibilityOverview['crawlers'] }>()
const { locale } = useI18n()
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
</script>
<template>
  <section class="border-t border-default pt-4">
    <details class="group/traffic">
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
      >
        <h2 class="text-base font-semibold">{{ $t('visibility.traffic.title') }}</h2>
        <UIcon
          name="mdi:chevron-down"
          class="size-4 text-muted transition-transform group-open/traffic:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        v-if="referrals.byChannel.length || crawlers.byBot.length"
        class="grid divide-y divide-default md:grid-cols-2 md:divide-x md:divide-y-0"
      >
        <div class="py-3 md:pr-5 md:last:pl-5 md:last:pr-0">
          <h3 class="text-sm font-medium text-muted">{{ $t('visibility.traffic.referrals') }}</h3>
          <dl v-if="referrals.byChannel.length" class="mt-2 divide-y divide-default">
            <div
              v-for="channel in referrals.byChannel"
              :key="channel.channel"
              class="flex items-center justify-between gap-4 py-2.5"
            >
              <dt class="text-sm text-highlighted">{{ $t(`visibility.channels.${channel.channel}`) }}</dt>
              <dd class="text-sm font-semibold tabular-nums">{{ number(channel.visits) }}</dd>
            </div>
          </dl>
          <p v-else class="mt-2 text-sm text-muted">{{ $t('visibility.traffic.none') }}</p>
        </div>
        <div class="py-3 md:pr-5 md:last:pl-5 md:last:pr-0">
          <h3 class="text-sm font-medium text-muted">{{ $t('visibility.traffic.crawlers') }}</h3>
          <dl v-if="crawlers.byBot.length" class="mt-2 divide-y divide-default">
            <div v-for="bot in crawlers.byBot" :key="bot.bot" class="flex items-center justify-between gap-4 py-2.5">
              <dt class="min-w-0">
                <span class="block truncate text-sm text-highlighted">{{ bot.bot }}</span>
                <span class="block text-xs text-muted">
                  {{ $t(`visibility.crawlers.kinds.${bot.kind}`) }} ·
                  <NuxtTime :datetime="bot.lastSeenAt" relative />
                </span>
              </dt>
              <dd class="text-sm font-semibold tabular-nums">{{ number(bot.requests) }}</dd>
            </div>
          </dl>
          <p v-else class="mt-2 text-sm text-muted">{{ $t('visibility.traffic.none') }}</p>
        </div>
      </div>
      <p v-else class="px-5 py-8 text-center text-sm text-muted">{{ $t('visibility.traffic.empty') }}</p>
    </details>
  </section>
</template>
