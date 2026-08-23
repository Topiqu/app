<template>
  <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
    <UserPictureUploader v-model="avatarUrl" @upload="$emit('upload')" />

    <div class="min-w-0 flex-1 text-center sm:text-left">
      <h2 class="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
        {{ username }}
      </h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">@{{ handle }}</p>

      <p
        class="mt-3 text-sm leading-relaxed text-pretty"
        :class="bio ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500 italic'"
      >
        {{ bio || $t('articles.userMenu.noBio') }}
      </p>

      <div
        class="mt-4 flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400"
      >
        <span class="inline-flex items-center gap-1.5 min-w-0">
          <Icon name="mdi:email-outline" class="size-4 shrink-0" />
          <span class="truncate">{{ email }}</span>
        </span>
        <span v-if="createdAt" class="inline-flex items-center gap-1.5">
          <Icon name="mdi:calendar-blank-outline" class="size-4 shrink-0" />
          {{ $t('common.user.joined', [formatDate(createdAt)]) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'

// Every field is optional: the page renders this panel before `/account` resolves (and while an
// unauthenticated visit is still being redirected), when `profileForm` is still an empty object.
defineProps<{ username?: string; handle?: string; bio?: string | null; email?: string; createdAt?: string }>()
defineEmits<{ (e: 'upload'): void }>()

const avatarUrl = defineModel<string | null | undefined>('avatarUrl')
</script>
