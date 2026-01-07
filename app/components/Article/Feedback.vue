<template>
  <div
    class="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50 p-1.5 transition-all duration-300 dark:border-gray-800 dark:bg-gray-900/40"
    :class="[
      showReasonInput
        ? 'bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/5'
        : 'hover:border-gray-200 dark:hover:border-gray-700',
    ]"
  >
    <div class="flex flex-col">
      <div class="flex items-center justify-between gap-3 px-3 py-1.5">
        <div class="flex items-center gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full transition-colors"
            :class="
              hasVoted
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            "
          >
            <Icon v-if="isLoading" name="svg-spinners:ring-resize" class="size-5" />
            <Icon v-else-if="hasVoted" name="mdi:check" class="size-5" />
            <Icon v-else name="mdi:message-question-outline" class="size-5" />
          </div>

          <div class="flex flex-col">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
              <span v-if="hasVoted">{{ $t('feedback.thankYou') }}</span>
              <span v-else>{{ $t('feedback.question') }}</span>
            </span>

            <span v-if="hasVoted" class="hidden items-center gap-1 text-xs text-gray-400 sm:inline-flex">
              {{ $t('feedback.recorded') }}
              <Button
                variant="transparent"
                size="sm"
                borderless
                class="!h-auto !p-0 text-xs text-gray-400 hover:text-gray-600 hover:underline dark:hover:text-gray-300"
                @click="resetVote"
              >
                {{ $t('feedback.change') }}
              </Button>
            </span>
          </div>
        </div>

        <div v-if="!hasVoted" class="flex items-center gap-2">
          <Button
            size="lg"
            variant="neutral"
            class="!h-9 !px-3"
            icon="mdi:thumb-up-outline"
            :disabled="isLoading"
            animation="softpop"
            @click="submitVote(true)"
          />
          <Button
            size="lg"
            variant="neutral"
            class="!h-9 !px-3"
            icon="mdi:thumb-down-outline"
            :disabled="isLoading"
            animation="softpop"
            :active="showReasonInput"
            :class="
              showReasonInput
                ? '!bg-red-50 !text-red-600 !ring-1 !ring-red-200 dark:!bg-red-900/20 dark:!border-red-800'
                : ''
            "
            @click="showReasonInput = true"
          />
        </div>
      </div>

      <div v-if="showReasonInput" class="animate-in slide-in-from-top-2 fade-in duration-300">
        <div class="mt-2 border-t border-gray-100 px-3 pb-3 pt-3 dark:border-gray-800">
          <FormInput
            v-model="reasonText"
            type="textarea"
            :placeholder="$t('feedback.placeholder', 'Co můžeme vylepšit?')"
            :maxLength="500"
            inputClass="!h-24 !bg-white dark:!bg-black/20 !text-sm"
            class="mb-2"
          />
          <div class="flex justify-end gap-2">
            <Button variant="transparent" size="sm" class="text-xs" @click="showReasonInput = false">
              {{ $t('common.actions.cancel') }}
            </Button>
            <Button
              variant="primary"
              size="sm"
              class="text-xs"
              icon="mdi:paper-airplane"
              animation="explode"
              :disabled="!reasonText || reasonText.length < 3"
              :loading="isLoading"
              @click="submitVote(false)"
            >
              {{ $t('common.actions.send') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
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
    if (isHelpful) toast.success({ message: $t('feedback.thanks_short') })
    showReasonInput.value = false
    reasonText.value = ''
  } catch {
    toast.error({ message: $t('error.generic') })
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

<style scoped>
.ease-out-back {
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
