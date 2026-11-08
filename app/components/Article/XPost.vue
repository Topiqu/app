<template>
  <figure
    class="not-prose my-8 flex flex-col gap-3 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-sm sm:p-5"
  >
    <figcaption class="flex min-w-0 items-center gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-inverted text-inverted">
        <UIcon name="mdi:twitter" class="size-5" />
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-semibold text-highlighted">{{ post.author }}</span>
        <span class="truncate text-sm text-muted">@{{ post.handle }}</span>
      </span>
    </figcaption>
    <blockquote :cite="post.url" class="flex flex-col gap-3 whitespace-pre-line break-words text-highlighted">
      <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
    </blockquote>
    <p v-if="post.media" class="flex items-center gap-1.5 text-sm text-muted">
      <UIcon name="mdi:image-outline" class="size-4 shrink-0" />
      {{ $t('articles.xPost.media') }}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3 text-sm text-muted">
      <AppTime v-if="post.date" :datetime="post.date" preset="date" />
      <UButton :to="post.url" external variant="link" color="primary" size="sm" trailingIcon="mdi:open-in-new">
        {{ $t('articles.xPost.view') }}
      </UButton>
    </div>
  </figure>
</template>

<script setup lang="ts">
import type { XPostData } from '~~/shared/utils/articleEmbeds'

const { post } = defineProps<{ post: XPostData }>()
const paragraphs = computed(() => post.text.split(/\n{2,}/).filter(Boolean))
</script>
