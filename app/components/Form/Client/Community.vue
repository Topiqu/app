<template>
  <section class="space-y-4">
    <div>
      <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.community.title') }}</h3>
      <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.community.description') }}</p>
    </div>

    <div
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <div class="flex items-start gap-4 p-5 sm:p-6">
        <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-muted" aria-hidden="true">
          <UIcon name="mdi:message-outline" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <label :for="commentsId" class="cursor-pointer text-sm font-semibold text-highlighted">
            {{ $t('common.preferences.community.comments') }}
          </label>
          <p :id="commentsHelpId" class="mt-1 text-sm leading-5 text-muted">
            {{ $t('common.preferences.community.commentsHelp') }}
          </p>
        </div>
        <USwitch :id="commentsId" v-model="commentsEnabled" :aria-describedby="commentsHelpId" />
      </div>

      <div class="flex items-start gap-4 p-5 sm:p-6">
        <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-muted" aria-hidden="true">
          <UIcon name="mdi:file-gif-box" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <label :for="gifsId" class="cursor-pointer text-sm font-semibold text-highlighted">
            {{ $t('common.preferences.community.gifs') }}
          </label>
          <p :id="gifsHelpId" class="mt-1 text-sm leading-5 text-muted">
            {{ $t('common.preferences.community.gifsHelp') }}
          </p>
        </div>
        <USwitch :id="gifsId" v-model="commentGifsEnabled" :aria-describedby="gifsHelpId" />
      </div>

      <div v-if="emoji" class="flex items-start gap-4 p-5 sm:p-6">
        <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-muted" aria-hidden="true">
          <UIcon name="mdi:emoticon-outline" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-highlighted">{{ $t('emoji.manage') }}</p>
          <p :id="emojiHelpId" class="mt-1 text-sm leading-5 text-muted">
            {{ $t('common.preferences.community.emojiHelp') }}
          </p>
        </div>
        <EmojiCreate>
          <UButton color="neutral" variant="soft" icon="mdi:emoticon-plus-outline" :aria-describedby="emojiHelpId">
            {{ $t('emoji.manageAction') }}
          </UButton>
        </EmojiCreate>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const commentsId = useId()
const commentsHelpId = useId()
const gifsId = useId()
const gifsHelpId = useId()
const emojiHelpId = useId()

const { emoji = false } = defineProps<{ emoji?: boolean }>()

const commentsEnabled = defineModel<boolean>('commentsEnabled', { required: true })
const commentGifsEnabled = defineModel<boolean>('commentGifsEnabled', { required: true })
</script>
