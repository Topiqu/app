<template>
  <div class="flex min-w-0 flex-col gap-2">
    <div class="flex items-baseline justify-between gap-3">
      <span :id="labelId" class="text-sm font-medium text-highlighted">
        {{ $t('common.preferences.aiAuthor.controversyLevel.label') }}
      </span>
      <span class="truncate text-xs font-medium text-muted" aria-hidden="true">{{ currentLabel }}</span>
    </div>

    <div class="px-4 pb-1.5 pt-1">
      <SliderRoot
        v-model="sliderValue"
        :min="0"
        :max="3"
        :step="1"
        class="relative flex h-10 w-full touch-none select-none items-center"
      >
        <SliderTrack class="relative h-1.5 grow rounded-full bg-accented">
          <SliderRange class="absolute h-full rounded-full bg-primary" />
        </SliderTrack>
        <span
          v-for="(option, index) in levels"
          :key="option"
          class="pointer-events-none absolute top-1/2 size-3 -translate-1/2 rounded-full ring-3 ring-default"
          :class="index <= tier ? 'bg-primary' : 'bg-accented'"
          :style="{ left: stop(index) }"
          aria-hidden="true"
        />
        <SliderThumb
          :aria-labelledby="labelId"
          :aria-describedby="`${exampleId} ${helpId}`"
          :aria-valuetext="`${tier}: ${currentLabel}`"
          class="block size-6 cursor-grab rounded-full bg-primary shadow-md ring-4 ring-default outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary/40 active:cursor-grabbing"
        />
      </SliderRoot>

      <div class="relative h-11">
        <UButton
          v-for="(option, index) in levels"
          :key="option"
          :label="$t(`common.preferences.aiAuthor.controversyLevel.short.${option}`)"
          :aria-label="`${index}: ${$t(`common.preferences.aiAuthor.controversyLevel.options.${option}`)}${index === recommended ? `, ${$t('common.preferences.aiAuthor.controversyLevel.recommended')}` : ''}`"
          :aria-pressed="tier === index"
          color="neutral"
          variant="link"
          size="xs"
          class="absolute top-0 -translate-x-1/2"
          :ui="{ base: tier === index ? 'px-1 font-semibold text-highlighted' : 'px-1 text-muted' }"
          :style="{ left: stop(index) }"
          @click="tier = index"
        />
        <span
          class="pointer-events-none absolute top-6 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-primary"
          :style="{ left: stop(recommended) }"
          aria-hidden="true"
          data-recommended
        >
          {{ $t('common.preferences.aiAuthor.controversyLevel.recommended') }}
        </span>
      </div>
    </div>

    <p :id="exampleId" class="text-sm leading-6 text-default">
      <span class="font-medium text-highlighted">{{
        $t('common.preferences.aiAuthor.controversyLevel.exampleLabel')
      }}</span>
      {{ $t(`common.preferences.aiAuthor.controversyLevel.examples.${levels[tier]}`) }}
    </p>

    <p :id="helpId" class="text-xs leading-5 text-muted">
      {{ $t('common.preferences.aiAuthor.controversyLevel.help') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

const level = defineModel<string>({ default: DEFAULT_CONTROVERSY_LEVEL })
const levels = CONTROVERSY_LEVELS
const recommended = levels.indexOf(DEFAULT_CONTROVERSY_LEVEL)
const labelId = useId()
const exampleId = useId()
const helpId = useId()
const { t } = useI18n()

// Reka keeps the thumb inside the track, so its centre runs from 12px to width − 12px (size-6), not 0–100 %.
const stop = (index: number) => `calc(${(index / 3) * 100}% + ${12 - (index / 3) * 24}px)`

const tier = computed({
  get: () => levels.indexOf(controversyLevelOf(level.value)),
  set: (value: number) => {
    level.value = levels[value] ?? DEFAULT_CONTROVERSY_LEVEL
  },
})
const sliderValue = computed({
  get: () => [tier.value],
  set: (value: number[]) => {
    tier.value = value[0] ?? 0
  },
})
const currentLabel = computed(() => t(`common.preferences.aiAuthor.controversyLevel.options.${levels[tier.value]}`))
</script>
