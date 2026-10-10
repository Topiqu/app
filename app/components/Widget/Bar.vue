<template>
  <aside
    v-if="visible"
    :aria-label="$t('widgets.announcement.label')"
    class="relative border-b"
    :class="[TEXT_SIZES[appearance.textSize], appearance.colors ? 'border-transparent' : TONES[announcement.tone]]"
    :style="
      appearance.colors ? { backgroundColor: appearance.colors.background, color: appearance.colors.text } : undefined
    "
  >
    <div
      class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 pl-4"
      :class="[
        appearance.alignment === 'center' ? 'justify-center text-center' : 'justify-start text-start',
        appearance.spacing === 'comfortable' ? 'py-4' : 'py-2',
        announcement.dismissible ? 'pr-12' : 'pr-4',
      ]"
    >
      <p class="min-w-0 whitespace-pre-line text-pretty break-words">
        <WidgetAnnouncementText :text="announcement.text" :runs="announcement.richText" />
      </p>
      <NuxtLink
        v-if="announcement.link"
        :to="announcement.link.url"
        :target="external ? '_blank' : undefined"
        class="max-w-full font-semibold break-words outline-offset-4 focus-visible:outline-2 focus-visible:outline-current"
        :class="
          appearance.linkStyle === 'button'
            ? 'inline-flex items-center justify-center rounded-md bg-current/10 px-3 py-1.5 text-center ring-1 ring-current/25 transition-colors hover:bg-current/20'
            : 'underline underline-offset-2'
        "
      >
        {{ announcement.link.label }}
      </NuxtLink>
    </div>
    <UButton
      v-if="announcement.dismissible"
      icon="mdi:close"
      size="xs"
      color="neutral"
      variant="link"
      class="absolute right-2 top-1/2 -translate-y-1/2 text-current"
      :aria-label="$t('widgets.announcement.close')"
      @click="close"
    />
  </aside>
</template>

<script setup lang="ts">
import {
  DEFAULT_ANNOUNCEMENT_APPEARANCE,
  type AnnouncementAppearance,
  type AnnouncementConfig,
  type AnnouncementTextRun,
} from '~~/shared/utils/widgets'

const { announcement, preview = false } = defineProps<{
  announcement: Pick<AnnouncementConfig, 'text' | 'link' | 'tone' | 'dismissible'> & {
    id: string
    appearance?: AnnouncementAppearance
    richText?: AnnouncementTextRun[] | null
  }
  preview?: boolean
}>()

const appearance = computed(() => ({ ...DEFAULT_ANNOUNCEMENT_APPEARANCE, ...announcement.appearance }))
const TEXT_SIZES = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' } as const

const TONES = {
  info: 'border-default bg-elevated text-highlighted',
  // The settings preview renders outside the publication surface, where the tenant variables are unset.
  accent:
    'border-transparent bg-[var(--topiqu-cta-bg,var(--ui-primary))] text-[var(--topiqu-cta-fg,white)] dark:bg-[var(--topiqu-cta-dark-bg,var(--ui-primary))]',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
} as const

// Read during SSR, so a closed bar is never rendered and then removed after hydration.
const dismissed = useCookie<string[]>('topiqu_bar', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  default: () => [],
})
const key = computed(() => announcementKey(announcement.id, announcement))
const visible = computed(() => preview || !dismissed.value.includes(key.value))
const external = computed(() => announcement.link?.url.startsWith('https://') ?? false)

function close() {
  if (!preview) dismissed.value = [key.value, ...dismissed.value].slice(0, 5)
}
</script>
