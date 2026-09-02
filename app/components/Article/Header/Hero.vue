<template>
  <div class="flex flex-col gap-4">
    <div v-if="series" class="flex items-center gap-3">
      <UBadge color="primary" variant="soft" icon="mdi:bookshelf">
        {{ $t('series.label', 'Série') }}
      </UBadge>
      <span class="text-sm font-medium text-muted">
        <span class="font-bold text-highlighted">{{ series.name }}</span>
        <span class="mx-2">•</span>
        {{ $t('series.part', 'Část') }} {{ series.current }} / {{ series.total }}
      </span>
    </div>

    <h1 class="mb-3 max-w-[24ch] text-3xl font-extrabold leading-tight text-highlighted sm:text-4xl lg:text-5xl">
      {{ title }}
    </h1>

    <div class="flex items-center gap-3 text-muted">
      <UserCard
        v-if="author.id && author.username"
        :user="{ id: author.id, username: author.username, avatarUrl: author.avatarUrl, bio: author.bio }"
        size="large"
        :roleLabel="$t('articles.articleCard.author')"
      />
      <div v-if="showFollowButton" class="flex flex-col">
        <div class="flex items-center gap-2">
          <UButton
            :color="isFollowing ? 'primary' : 'neutral'"
            :variant="isFollowing ? 'solid' : 'soft'"
            :icon="isFollowing ? 'mdi:account-check' : 'mdi:account-plus'"
            @click="$emit('follow')"
          >
            {{ isFollowing ? $t('profile.unfollow') : $t('profile.follow') }}
          </UButton>
        </div>
      </div>
    </div>

    <p
      v-if="excerpt"
      class="rounded-[var(--ui-radius)] border-l-3 border-primary bg-elevated px-5 py-4 text-lg italic leading-relaxed text-highlighted md:text-xl"
    >
      {{ excerpt }}
    </p>

    <AppMedia
      :src="imageUrl"
      :alt="$t('articles.articleCard.imageAlt')"
      aspectRatio="16 / 9"
      fit="contain"
      sizes="100vw lg:1200px"
      :width="1200"
      :height="675"
      containerClass="w-full rounded-lg"
    />
  </div>
</template>

<script setup lang="ts">
import type { CoverCredit } from '~~/shared/utils/imageCredit'

defineProps<{
  title: string
  author: { id?: string; username: string; avatarUrl?: string | null; bio?: string | null }
  followerCount: number
  isFollowing: boolean
  showFollowButton: boolean
  excerpt?: string | null
  imageUrl?: string | null
  imageCredit?: CoverCredit | null
  discloseAi?: boolean
  series?: { name: string; current: number; total: number } | null
}>()

defineEmits<{
  (e: 'follow'): void
}>()
</script>
