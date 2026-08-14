<template>
  <UCard>
    <div class="flex flex-col">
      <div class="flex items-center justify-between gap-3 px-3 py-1.5">
        <div class="flex items-center gap-3">
          <div class="flex size-8 items-center justify-center">
            <UProgress v-if="isLoading" size="xs" class="w-5" />
            <UIcon v-else-if="hasVoted" size="20" name="i-mdi-check" />
            <UIcon v-else size="20" name="i-mdi-message-question-outline" />
          </div>

          <div class="flex flex-col">
            <span class="text-sm font-medium text-highlighted">
              <span v-if="hasVoted">{{ $t('feedback.thankYou') }}</span>
              <span v-else>{{ $t('feedback.question') }}</span>
            </span>

            <span v-if="hasVoted" class="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
              {{ $t('feedback.recorded') }}
              <UButton color="neutral" variant="ghost" size="sm" @click="resetVote">
                {{ $t('feedback.change') }}
              </UButton>
            </span>
          </div>
        </div>

        <div v-if="!hasVoted" class="flex items-center gap-2">
          <UButton
            size="lg"
            color="neutral"
            variant="soft"
            icon="i-mdi-thumb-up-outline"
            :disabled="isLoading"
            :aria-label="$t('common.yes')"
            :title="$t('common.yes')"
            @click="submitVote(true)"
          />
          <UButton
            size="lg"
            :color="showReasonInput ? 'error' : 'neutral'"
            :variant="showReasonInput ? 'solid' : 'soft'"
            icon="i-mdi-thumb-down-outline"
            :aria-label="$t('common.no')"
            :title="$t('common.no')"
            :disabled="isLoading"
            :active="showReasonInput"
            @click="showReasonInput = true"
          />
        </div>
      </div>

      <div v-if="showReasonInput">
        <div class="mt-2 px-3 pb-3 pt-3">
          <USeparator class="mb-3" />
          <UFormField :label="$t('feedback.placeholder', 'Co můžeme vylepšit?')">
            <UTextarea
              v-model="reasonText"
              :placeholder="$t('feedback.placeholder', 'Co můžeme vylepšit?')"
              :maxlength="500"
              class="mb-2 min-h-24"
              autoresize
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" size="sm" @click="showReasonInput = false">
              {{ $t('common.actions.cancel') }}
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              size="sm"
              icon="i-mdi-paper-airplane"
              :disabled="!reasonText || reasonText.length < 3"
              :loading="isLoading"
              @click="submitVote(false)"
            >
              {{ $t('common.actions.send') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{ articleId: string }>()

const toast = useToast()
const isLoading = shallowRef(false)
const showReasonInput = shallowRef(false)
const reasonText = shallowRef('')

const votedCookie = useCookie<boolean | string>(`feedback_voted_${props.articleId}`, {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})

const sessionCookie = useCookie('client_session_id', { maxAge: 60 * 60 * 24 * 365 })
if (!sessionCookie.value)
  sessionCookie.value = crypto.randomUUID?.() ?? Math.random().toString(36).substring(2) + Date.now().toString(36)

const hasVoted = computed(() => !!votedCookie.value)

const submitVote = async (isHelpful: boolean) => {
  isLoading.value = true
  try {
    await $fetch(`/api/articles/${props.articleId}/feedback`, {
      method: 'POST',
      body: { isHelpful, reason: isHelpful ? null : reasonText.value, sessionId: sessionCookie.value },
    })
    votedCookie.value = isHelpful ? 'helpful' : 'unhelpful'
    if (isHelpful) toast.add({ color: 'success', title: $t('feedback.thanks_short') })
    showReasonInput.value = false
    reasonText.value = ''
  } catch {
    toast.add({ color: 'error', title: $t('error.generic') })
  } finally {
    setTimeout(() => (isLoading.value = false), 400)
  }
}

const resetVote = () => {
  votedCookie.value = false
  showReasonInput.value = false
  reasonText.value = ''
}
</script>
