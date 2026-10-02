<template>
  <section v-if="discussions?.length" class="space-y-6" aria-labelledby="discussions-title">
    <h2 id="discussions-title" class="text-2xl font-bold tracking-tight text-highlighted">
      {{ $t('articles.home.discussions') }}
    </h2>
    <ul class="grid gap-4 md:grid-cols-2">
      <li v-for="comment in discussions" :key="comment.id">
        <article
          class="relative flex h-full flex-col gap-3 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 transition-colors hover:border-accented sm:p-5"
        >
          <header class="flex min-w-0 items-center gap-2 text-sm">
            <UserPicture :url="comment.user.avatarUrl" :name="comment.user.username" size="sm" />
            <span class="truncate font-semibold text-highlighted">{{ comment.user.username }}</span>
            <AppTime :datetime="comment.createdAt" preset="relative" class="shrink-0 text-xs text-muted" />
          </header>
          <blockquote class="line-clamp-3 text-pretty text-sm leading-6 text-toned">{{ comment.content }}</blockquote>
          <footer
            class="mt-auto flex items-center justify-between gap-3 border-t border-default pt-3 text-xs text-muted"
          >
            <NuxtLink
              :to="`${localePath({ name: 'clanky-slug', params: { slug: comment.article.slug } }, comment.article.language)}#comments`"
              class="line-clamp-1 font-medium text-default after:absolute after:inset-0 hover:underline"
            >
              {{ comment.article.title }}
            </NuxtLink>
            <span class="inline-flex shrink-0 items-center gap-1 tabular-nums">
              <UIcon name="mdi:comment-outline" size="14" aria-hidden="true" />
              {{ $t('articles.comments.unit', comment.article.comments) }}
            </span>
          </footer>
        </article>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const { site } = defineProps<{ site: string }>()

const localePath = useLocalePath()
const { locale } = useI18n()

const { data: discussions } = await useLazyFetch(`/api/comments/by-clientsite/${site}`, { query: { locale } })
</script>
