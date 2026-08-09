<template>
  <section class="custom-ui flex flex-col gap-2.5">
    <div class="flex items-center justify-between gap-2">
      <h2
        class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500 dark:text-gray-400"
      >
        <Icon name="mdi:auto-fix" class="w-3.5 h-3.5 text-indigo-500" />
        {{ $t('common.labels.aiGeneration') }}
      </h2>
      <span
        v-if="generating"
        class="flex items-center gap-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500"
        aria-live="polite"
      >
        <span v-if="streamedWords">{{ streamedWords }} {{ $t('articles.editor.toolbar.words') }}</span>
        <span>{{ elapsed }}</span>
      </span>
    </div>

    <div
      class="relative overflow-hidden rounded-2xl border bg-white dark:bg-gray-900 transition-colors"
      :class="
        generating || focused
          ? 'border-indigo-400 dark:border-indigo-500/70'
          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
      "
    >
      <div v-if="generating" class="absolute inset-x-0 top-0 h-0.5 bg-indigo-500/15">
        <div class="h-full w-1/3 bg-indigo-500 animate-progress-slide motion-reduce:animate-none" />
      </div>

      <label class="sr-only" :for="promptId">{{ $t('articles.editor.ai.topicLabel') }}</label>
      <textarea
        :id="promptId"
        ref="textarea"
        v-model="topic"
        :disabled="generating"
        :placeholder="$t('articles.editor.ai.topicPlaceholder')"
        rows="2"
        class="w-full resize-none bg-transparent! border-none! rounded-none! px-3.5 pt-3.5 pb-2 text-sm leading-relaxed placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-0 disabled:opacity-60"
        @focus="focused = true"
        @blur="focused = false"
        @keydown.meta.enter.prevent="generate"
        @keydown.ctrl.enter.prevent="generate"
      />

      <div class="flex flex-wrap gap-1.5 px-3.5 pb-3">
        <ArticleEditorChip
          v-for="option in formats"
          :key="option.id"
          :active="format === option.id"
          :disabled="generating"
          @click="format = format === option.id ? null : option.id"
        >
          {{ option.label }}
        </ArticleEditorChip>
      </div>

      <div
        class="flex items-center gap-2 border-t border-gray-100 dark:border-gray-800/80 px-2.5 py-2 min-h-12"
        :class="generating ? '' : 'justify-between'"
      >
        <template v-if="generating">
          <ol class="flex items-center gap-1.5 min-w-0 text-[11px] font-medium">
            <li
              v-for="(step, i) in steps"
              :key="step"
              class="flex items-center gap-1.5"
              :class="
                stepState(step) === 'active'
                  ? 'text-indigo-600 dark:text-indigo-300'
                  : stepState(step) === 'done'
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-300 dark:text-gray-600'
              "
            >
              <Icon
                v-if="stepState(step) === 'done'"
                name="mdi:check-circle"
                class="w-3.5 h-3.5 shrink-0"
                aria-hidden="true"
              />
              <Icon
                v-else-if="stepState(step) === 'active'"
                name="mdi:loading"
                class="w-3.5 h-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span v-else class="w-3.5 flex justify-center" aria-hidden="true">
                <span class="w-1.5 h-1.5 rounded-full bg-current" />
              </span>
              <span class="truncate">{{ $t(`articles.editor.ai.step.${step}`) }}</span>
              <Icon
                v-if="i < steps.length - 1"
                name="mdi:chevron-right"
                class="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 shrink-0"
                aria-hidden="true"
              />
            </li>
          </ol>
          <Button
            size="sm"
            icon="mdi:stop"
            variant="neutral"
            class="ml-auto shrink-0 bg-transparent! border-gray-200! dark:border-gray-700! text-red-600! dark:text-red-400! hover:bg-red-50! dark:hover:bg-red-950/40!"
            @click="stopGeneration"
          >
            {{ $t('articles.editor.ai.stopButton') }}
          </Button>
        </template>

        <template v-else>
          <span class="pl-1 text-[11px] text-gray-400 dark:text-gray-500 select-none">
            <kbd class="font-sans">{{ shortcutHint }}</kbd>
          </span>
          <div class="flex items-center gap-2 shrink-0">
            <ArticleEditorChip v-if="canUndoEnhance" icon="mdi:undo-variant" size="md" @click="undoEnhance">
              {{ $t('articles.editor.ai.enhanceUndo') }}
            </ArticleEditorChip>
            <ArticleEditorChip
              v-else
              :icon="enhancing ? 'mdi:loading' : 'mdi:creation-outline'"
              size="md"
              :disabled="!canEnhance"
              @click="enhance"
            >
              {{ $t('articles.editor.ai.enhance') }}
            </ArticleEditorChip>
            <Button
              size="sm"
              icon="mdi:auto-fix"
              :disabled="!canGenerate"
              class="bg-indigo-600! hover:bg-indigo-700! text-white! border-transparent!"
              @click="generate"
            >
              {{ $t('articles.editor.ai.generateButton') }}
            </Button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type Phase = 'writing' | 'images'

const emit = defineEmits<{
  partial: [partial: { title?: string; perex?: string; content?: string }]
  image: [image: { slot: number; html: string }]
  final: [article: Record<string, any>]
  /** The stream ended without a `final`, so the streamed body still carries unfilled slot markers. */
  settle: []
}>()

const { autofocus = false } = defineProps<{ autofocus?: boolean }>()

const generating = defineModel<boolean>('generating', { default: false })

const { t } = useI18n()
const toast = useToast()
const promptId = useId()

const steps: Phase[] = ['writing', 'images']

const formats = computed(() => AI_FORMATS.map((id) => ({ id, label: t(`articles.editor.ai.formats.${id}.label`) })))

const focused = shallowRef(false)
const enhancing = shallowRef(false)
/** The author's own wording, kept while the enhanced version is still untouched on screen. */
const originalTopic = shallowRef<string | null>(null)
const enhancedTopic = shallowRef<string | null>(null)
const format = shallowRef<AiFormat | null>(null)
const phase = shallowRef<Phase>('writing')
/** Whether this run delivered its `final`. Drives both the slot cleanup and the unmount abort. */
const finalized = shallowRef(false)
const streamedWords = shallowRef(0)
const elapsedMs = shallowRef(0)

const { textarea, input: topic } = useTextareaAutosize({ styleProp: 'minHeight' })

const { streamGenerate, stop: stopGeneration } = useArticleGeneration()

const { pause, resume } = useIntervalFn(() => (elapsedMs.value = Date.now() - startedAt), 1000, { immediate: false })
let startedAt = 0

const shortcutHint = shallowRef('Ctrl ↵')

const elapsed = computed(() => formatElapsed(elapsedMs.value))
const canGenerate = computed(() => topic.value.trim().length > 0 && !generating.value)
const canEnhance = computed(() => canGenerate.value && !enhancing.value)
// Undo survives only while the enhanced text is untouched — once the author edits it, the
// wording is theirs and reverting would throw away their work instead of the model's.
const canUndoEnhance = computed(() => originalTopic.value !== null && topic.value === enhancedTopic.value)
const stepState = (step: Phase) =>
  step === phase.value ? 'active' : steps.indexOf(step) < steps.indexOf(phase.value) ? 'done' : 'pending'

onMounted(() => {
  if (/mac|iphone|ipad/i.test(navigator.userAgent)) shortcutHint.value = '⌘ ↵'
  if (autofocus) textarea.value?.focus()
})

// Enhancing overwrites what the author typed, so the original stays recoverable until they
// edit the field themselves — at which point the enhanced text is theirs and undo is meaningless.
const enhance = async () => {
  if (!canEnhance.value) return

  const before = topic.value
  enhancing.value = true
  try {
    const { prompt } = await $fetch<{ prompt: string }>('/api/articles/generate/enhance', {
      method: 'POST',
      body: { prompt: before },
    })
    if (!prompt) return
    topic.value = prompt
    originalTopic.value = before
    enhancedTopic.value = prompt
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('articles.editor.ai.enhanceFailed') })
  } finally {
    enhancing.value = false
  }
}

const undoEnhance = () => {
  if (originalTopic.value === null) return
  topic.value = originalTopic.value
  originalTopic.value = null
  enhancedTopic.value = null
}

const generate = async () => {
  if (!canGenerate.value) return

  const prompt = composeAiPrompt(
    topic.value,
    format.value ? t(`articles.editor.ai.formats.${format.value}.template`) : null,
  )

  generating.value = true
  phase.value = 'writing'
  streamedWords.value = 0
  elapsedMs.value = 0
  startedAt = Date.now()
  resume()

  finalized.value = false

  try {
    const outcome = await streamGenerate(prompt, {
      onPartial: (partial) => {
        if (partial.content != null) streamedWords.value = countHtmlWords(partial.content)
        emit('partial', partial)
      },
      onPhase: (next) => (phase.value = next),
      onImage: (image) => emit('image', image),
      onFinal: (article) => {
        finalized.value = true
        streamedWords.value = countHtmlWords(article.content)
        emit('final', article)
      },
    })

    if (outcome === 'aborted') toast.info({ message: t('articles.editor.ai.aiContentStopped') })
    else toast.success({ message: t('articles.editor.aiContentGenerated') })
  } catch {
    toast.error({ message: t('articles.editor.aiContentFailed') })
  } finally {
    pause()
    generating.value = false
    // Stopped, errored or the stream closed early: the body on screen is the raw model text, and
    // nothing else will ever fill its `[[IMAGE1]]`/`[[POLL1]]` markers.
    if (!finalized.value) emit('settle')
  }
}

// Applying the `final` closes the composer, which unmounts it while `generating` is still true —
// so an unguarded stop here aborted the very stream that had just succeeded and reported it to the
// author as "generation stopped".
onBeforeUnmount(() => {
  pause()
  if (generating.value && !finalized.value) stopGeneration()
})
</script>
