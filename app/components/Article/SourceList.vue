<template>
  <ol class="divide-y divide-default border-y border-default">
    <li v-for="(source, index) in entries" :key="`${index}-${source.url}`" class="min-w-0">
      <component
        :is="source.valid ? 'a' : 'div'"
        :href="source.valid ? source.url : undefined"
        :target="source.valid ? '_blank' : undefined"
        :rel="source.valid ? 'noopener noreferrer' : undefined"
        :title="source.url"
        class="group grid min-w-0 grid-cols-[1rem_1.25rem_minmax(0,1fr)_1rem] items-center gap-3 px-3 py-4"
        :class="
          source.valid
            ? 'rounded-sm transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'
            : ''
        "
      >
        <span class="text-xs tabular-nums text-muted">{{ index + 1 }}</span>
        <AppMedia
          :src="sourceFaviconUrl(source.url)"
          alt=""
          fallbackIcon="mdi:web"
          :fallbackBorder="false"
          aspectRatio="1 / 1"
          fit="contain"
          sizes="20px"
          containerClass="size-5 shrink-0 rounded-sm bg-transparent"
        />
        <span class="min-w-0">
          <span
            class="block break-words text-sm font-semibold text-highlighted"
            :class="source.valid ? 'group-hover:underline group-focus-visible:underline underline-offset-4' : ''"
          >
            {{ source.hostname }}
          </span>
          <span v-if="source.path" class="mt-1 line-clamp-2 break-all text-xs leading-relaxed text-muted">{{
            source.path
          }}</span>
        </span>
        <UIcon
          v-if="source.valid"
          name="mdi:open-in-new"
          class="size-4 text-muted group-hover:text-primary group-focus-visible:text-primary"
          aria-hidden="true"
        />
      </component>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { presentSourceUrl, sourceFaviconUrl } from '~/utils/sourcePresentation'

const { sources } = defineProps<{ sources: string[] }>()
const entries = computed(() =>
  sources.filter((source) => source.trim()).map((source) => ({ url: source.trim(), ...presentSourceUrl(source) })),
)
</script>
