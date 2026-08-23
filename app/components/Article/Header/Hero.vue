<template>
  <div class="flex flex-col gap-4">
    <div v-if="series" class="flex items-center gap-3">
      <UBadge color="primary" variant="soft" icon="i-mdi-bookshelf">
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
      <UserPicture :url="author.avatarUrl" :size="'md'" :name="author.username" />
      <div class="flex flex-col">
        <div class="flex items-center gap-2">
          <ULink v-if="author.username" :to="localePath({ name: 'autor-name', params: { name: author.username } })">
            {{ author.username }}
          </ULink>
          <span v-else class="text-[17px] font-medium text-highlighted">{{ $t('common.user.notAvailable') }}</span>
          <span class="text-sm italic text-muted">• {{ $t('articles.articleCard.author') }}</span>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <UBadge color="neutral" variant="soft" icon="i-mdi-account-group">
            {{ followerCount }}
            {{ $t('profile.followers') }}
          </UBadge>
          <UButton
            v-if="showFollowButton"
            :color="isFollowing ? 'primary' : 'neutral'"
            :variant="isFollowing ? 'solid' : 'soft'"
            :icon="isFollowing ? 'i-mdi-account-check' : 'i-mdi-account-plus'"
            @click="$emit('follow')"
          >
            {{ isFollowing ? $t('profile.unfollow') : $t('profile.follow') }}
          </UButton>
        </div>
      </div>
    </div>

    <UCard v-if="excerpt"
      ><p class="text-lg italic leading-relaxed text-highlighted md:text-xl">{{ excerpt }}</p></UCard
    >

    <AppMedia
      :src="imageUrl"
      :alt="$t('articles.articleCard.imageAlt')"
      aspectRatio="16 / 9"
      fit="contain"
      sizes="100vw lg:1200px"
      containerClass="w-full rounded-lg"
    />
  </div>
</template>

<script setup lang="ts">
import type { CoverCredit } from '~~/shared/utils/imageCredit'

const localePath = useLocalePath()

defineProps<{
  title: string
  author: { username: string; avatarUrl?: string | null }
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
