<template>
  <div
    class="relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white/50 p-1 shadow-sm backdrop-blur-xl transition-all dark:border-gray-800 dark:bg-gray-900/40"
  >
    <div class="flex flex-col gap-5 p-5 sm:p-6">
      <div v-if="!hasVoted" class="flex flex-col items-center gap-2 text-center">
        <div
          class="mb-2 flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Icon name="mdi:message-question-outline" class="size-5" />
        </div>
        <h3 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {{ $t('feedback.question') }}
        </h3>
        <p class="max-w-xs text-sm text-gray-500 dark:text-gray-400">
          {{ $t('feedback.subtitle') }}
        </p>
      </div>
      <div
        v-if="isLoading"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/60 backdrop-blur-sm dark:bg-gray-950/60"
      >
        <Icon name="svg-spinners:180-ring-with-bg" class="size-8 text-indigo-500" />
        <span class="text-xs font-medium text-gray-500">{{ $t('common.processing') }}...</span>
      </div>
      <div v-if="!hasVoted" class="flex flex-col gap-4 transition-all">
        <div class="flex w-full gap-3 sm:gap-4">
          <Button
            class="flex-1"
            size="lg"
            variant="neutral"
            icon="mdi:thumb-up-outline"
            animation="softpop"
            @click="submitVote(true)"
          >
            {{ $t('common.yes') }}
          </Button>
          <Button
            class="flex-1"
            size="lg"
            variant="neutral"
            icon="mdi:thumb-down-outline"
            :active="showReasonInput"
            :class="showReasonInput ? '!ring-2 !ring-red-500/20 !bg-red-50 dark:!bg-red-900/10' : ''"
            animation="softpop"
            @click="showReasonInput = true"
          >
            {{ $t('common.no') }}
          </Button>
        </div>
        <div
          v-if="showReasonInput"
          class="flex flex-col gap-3 animate-in slide-in-from-top-4 fade-in duration-300 ease-out"
        >
          <div class="relative">
            <div class="absolute -top-2 left-1/2 -translate-x-1/2">
              <Icon name="mdi:triangle" class="text-gray-100 dark:text-neutral-700 rotate-180" />
            </div>
            <FormInput
              v-model="reasonText"
              type="textarea"
              icon="mdi:comment-quote-outline"
              iconPosition="leading"
              :placeholder="$t('feedback.placeholder')"
              :maxLength="500"
              class="shadow-sm"
            />
          </div>
          <div class="flex items-center justify-end gap-2">
            <Button variant="transparent" size="sm" @click="showReasonInput = false">
              {{ $t('common.actions.cancel') }}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="mdi:paper-airplane"
              animation="explode"
              @click="submitVote(false)"
            >
              {{ $t('common.actions.send') }}
            </Button>
          </div>
        </div>
      </div>
      <div
        v-else
        class="flex flex-col items-center justify-center gap-4 py-4 text-center animate-in zoom-in-95 duration-500 ease-out-back"
      >
        <div
          class="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-tr from-green-100 to-emerald-50 text-emerald-600 shadow-inner dark:from-green-900/30 dark:to-emerald-900/10 dark:text-emerald-400"
        >
          <Icon name="mdi:check-circle" class="size-8 animate-in zoom-in spin-in-12 duration-700" />
          <Icon name="mdi:star-four-points" class="absolute -top-1 -right-1 size-4 text-yellow-400 animate-pulse" />
          <Icon
            name="mdi:star-four-points"
            class="absolute bottom-0 -left-2 size-3 text-blue-400 animate-pulse delay-100"
          />
        </div>
        <div class="space-y-1">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ $t('feedback.thankYou') }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('feedback.recorded') }}
          </p>
        </div>
        <Button
          variant="transparent"
          size="sm"
          class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          @click="resetVote"
        >
          {{ $t('feedback.change') }}
        </Button>
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
