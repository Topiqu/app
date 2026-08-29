<template>
  <UModal v-model:open="open" scrollable :title="$t('common.preferences.guide.title')" :ui="{ content: 'max-w-3xl' }">
    <slot :open="openDialog" />

    <template #body>
      <div class="space-y-6">
        <p class="text-sm leading-relaxed text-muted">{{ $t('common.preferences.guide.intro') }}</p>

        <ol class="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          <li v-for="(step, index) in flow" :key="step" class="flex items-center gap-1.5">
            <span class="rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-toned">
              {{ $t(`common.preferences.guide.flow.${step}`) }}
            </span>
            <UIcon v-if="index < flow.length - 1" name="i-mdi-chevron-right" size="16" class="text-dimmed" />
          </li>
        </ol>

        <section class="rounded-xl border border-default bg-elevated/40 p-4">
          <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
            <UIcon name="i-mdi-code-braces" size="16" />
            {{ $t('common.preferences.guide.preview.title') }}
          </h3>
          <dl class="mt-3 space-y-1 font-mono text-xs sm:text-sm">
            <div v-for="line in preview" :key="line.label" class="flex gap-2">
              <dt class="shrink-0 text-dimmed">{{ line.label }}:</dt>
              <dd class="min-w-0 break-words" :class="line.filled ? 'text-highlighted' : 'italic text-dimmed'">
                {{ line.value }}
              </dd>
            </div>
          </dl>
          <p class="mt-3 text-xs leading-relaxed text-muted">{{ $t('common.preferences.guide.preview.hint') }}</p>
        </section>

        <section v-for="section in sections" :key="section.key" class="border-t border-default pt-5">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 class="flex items-center gap-2 font-semibold text-highlighted">
              <UIcon :name="section.icon" size="20" class="text-primary" />
              {{ $t(`common.preferences.${section.key}.label`) }}
            </h3>
            <span class="text-xs text-dimmed">
              {{ $t('common.preferences.guide.usedIn') }}:
              {{ $t(`common.preferences.guide.${section.key}.usedIn`) }}
            </span>
          </div>

          <p class="mt-2 text-sm leading-relaxed text-toned">
            {{ $t(`common.preferences.guide.${section.key}.description`) }}
          </p>

          <div v-if="section.examples" class="mt-3 grid gap-2 sm:grid-cols-2">
            <div class="rounded-lg border border-success/30 bg-success/5 p-3">
              <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success">
                <UIcon name="i-mdi-check-circle-outline" size="16" />
                {{ $t('common.preferences.guide.good') }}
              </p>
              <p class="mt-1.5 text-sm leading-relaxed text-toned">
                {{ $t(`common.preferences.guide.${section.key}.good`) }}
              </p>
            </div>
            <div class="rounded-lg border border-error/30 bg-error/5 p-3">
              <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-error">
                <UIcon name="i-mdi-close-circle-outline" size="16" />
                {{ $t('common.preferences.guide.bad') }}
              </p>
              <p class="mt-1.5 text-sm leading-relaxed text-toned">
                {{ $t(`common.preferences.guide.${section.key}.bad`) }}
              </p>
            </div>
          </div>

          <p
            v-if="section.examples"
            class="mt-3 flex gap-2 rounded-lg p-2.5 text-sm leading-relaxed"
            :class="section.filled ? 'text-muted' : 'bg-warning/10 text-warning'"
          >
            <UIcon
              :name="section.filled ? 'i-mdi-information-outline' : 'i-mdi-alert-outline'"
              size="16"
              class="mt-0.5 shrink-0"
            />
            <span>
              <span class="font-medium">{{ $t('common.preferences.guide.empty') }}:</span>
              {{ $t(`common.preferences.guide.${section.key}.empty`) }}
            </span>
          </p>

          <p
            v-if="section.extra"
            class="mt-3 flex gap-2 rounded-lg bg-elevated/60 p-2.5 text-sm leading-relaxed text-muted"
          >
            <UIcon name="i-mdi-lightbulb-outline" size="16" class="mt-0.5 shrink-0" />
            <span>{{ $t(`common.preferences.guide.${section.key}.${section.extra}`) }}</span>
          </p>
        </section>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" size="lg" @click="close">{{ $t('common.close') }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const {
  focus = '',
  audience = '',
  language = 'en',
  keywords = [],
} = defineProps<{
  focus?: string
  audience?: string
  language?: string
  keywords?: string[]
}>()

const open = defineModel<boolean>({ default: false })
const openDialog = () => (open.value = true)

const flow = ['brief', 'topic', 'article', 'publish'] as const

const sections = computed(() => [
  { key: 'focus', icon: 'i-mdi-bullseye', filled: Boolean(focus.trim()), examples: true, extra: '' },
  { key: 'audience', icon: 'i-mdi-account-group-outline', filled: Boolean(audience.trim()), examples: true, extra: '' },
  { key: 'language', icon: 'i-mdi-translate', filled: true, examples: false, extra: 'warning' },
  { key: 'keywords', icon: 'i-mdi-tag-multiple-outline', filled: keywords.length > 0, examples: true, extra: 'note' },
])

// Mirrors the block the model actually receives (server/utils/ai/topic.ts) — field names and the
// fallbacks for an empty field are the server's, so they stay untranslated on purpose.
const preview = computed(() => {
  const line = (label: string, value: string, fallback: string) => ({
    label,
    value: value.trim() || fallback,
    filled: Boolean(value.trim()),
  })
  return [
    line('Audience', audience, 'general'),
    line('Focus', focus, 'general topics'),
    line('Keywords', keywords.join(', '), 'none'),
    line('Language', language.toUpperCase(), ''),
  ]
})
</script>
