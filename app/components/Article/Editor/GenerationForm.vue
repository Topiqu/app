<template>
  <fieldset :disabled="aiGenerating" class="flex min-w-0 flex-col gap-4 disabled:opacity-70">
    <legend class="sr-only">{{ $t('articles.editor.tabs.ai') }}</legend>
    <UFormField :label="$t('articles.editor.ai.topicLabel')">
      <ArticleEditorPromptInput
        v-model="customPrompt"
        :disabled="aiGenerating"
        :label="$t('articles.editor.ai.topicLabel')"
        :placeholder="
          aiOptions.format === 'story'
            ? $t('articles.editor.ai.topicPlaceholderStory')
            : $t('articles.editor.ai.topicPlaceholder')
        "
      />
    </UFormField>
    <ArticleEditorPromptTools v-model="customPrompt" :format="aiOptions.format" />

    <UFormField :label="$t('articles.editor.ai.outputLabel')">
      <USelect :modelValue="aiOptions.format" :items="formatItems" class="w-full" @update:modelValue="selectFormat" />
    </UFormField>

    <UCollapsible v-model:open="advancedOpen" :ui="{ root: 'border-y border-default' }">
      <UButton
        color="neutral"
        variant="ghost"
        type="button"
        class="w-full"
        :ui="{ base: 'px-0', trailingIcon: 'ms-auto' }"
        :trailingIcon="advancedOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
      >
        <span class="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <span class="font-medium text-highlighted">{{ $t('articles.editor.ai.advanced') }}</span>
          <span class="truncate text-xs font-normal text-muted">{{ advancedSummary }}</span>
        </span>
      </UButton>
      <template #content>
        <div class="flex flex-col gap-5 pb-4 pt-2">
          <div class="flex flex-col gap-3">
            <USwitch
              v-model="aiOptions.research.enabled"
              :aria-label="$t('articles.editor.ai.researchLabel')"
              :label="$t('articles.editor.ai.researchLabel')"
              :ui="{ root: 'flex-row-reverse justify-between', wrapper: 'ms-0 me-3' }"
            />
            <template v-if="aiOptions.research.enabled">
              <fieldset>
                <legend class="sr-only">{{ $t('articles.editor.ai.depthLabel') }}</legend>
                <div class="flex rounded-md bg-elevated p-1">
                  <label v-for="depth in depthItems" :key="depth.value" class="relative flex-1 cursor-pointer">
                    <input
                      v-model="aiOptions.research.depth"
                      type="radio"
                      :name="researchDepthName"
                      :value="depth.value"
                      class="peer sr-only"
                    />
                    <span
                      class="flex min-h-9 items-center justify-center rounded text-sm text-muted peer-checked:bg-default peer-checked:font-semibold peer-checked:text-primary peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                      >{{ depth.label }}</span
                    >
                  </label>
                </div>
              </fieldset>
              <UCheckbox
                v-model="aiOptions.research.fallbackWithoutResearch"
                :label="$t('articles.editor.ai.researchFallback')"
              />
            </template>
          </div>

          <!-- Options saved before this switch existed lack the field; they meant "use it". -->
          <USwitch
            :modelValue="aiOptions.useKnowledge !== false"
            :aria-label="$t('articles.editor.ai.useKnowledge')"
            :label="$t('articles.editor.ai.useKnowledge')"
            :ui="{ root: 'flex-row-reverse justify-between', wrapper: 'ms-0 me-3' }"
            @update:modelValue="aiOptions.useKnowledge = $event"
          />

          <fieldset>
            <legend class="mb-2 text-sm font-medium text-highlighted">
              {{ $t('articles.editor.ai.modulesLabel') }}
            </legend>
            <div class="flex flex-wrap gap-2">
              <label v-for="item in moduleItems" :key="item.value" class="cursor-pointer">
                <input v-model="aiOptions.modules" type="checkbox" :value="item.value" class="peer sr-only" />
                <span
                  class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-default px-3 text-sm text-toned hover:bg-elevated peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:font-medium peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                >
                  <UIcon
                    :name="aiOptions.modules.includes(item.value) ? 'mdi:check' : 'mdi:plus'"
                    class="size-4"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </span>
              </label>
            </div>
            <UCheckbox
              v-if="aiOptions.modules.includes('images')"
              v-model="aiOptions.allowGeneratedImages"
              :label="$t('articles.editor.ai.allowGeneratedImages')"
              class="mt-3"
            />
            <p v-if="aiOptions.modules.includes('youtube')" class="mt-2 text-xs leading-5 text-muted">
              {{ $t('articles.editor.ai.youtubeHint') }}
            </p>
          </fieldset>
        </div>
      </template>
    </UCollapsible>

    <div class="flex items-center gap-2 pt-2">
      <UButton block size="lg" :disabled="aiGenerating || !customPrompt.trim()" @click="$emit('generate')">
        {{ $t(aiGenerating ? 'articles.editor.ai.run.title.running' : 'articles.editor.ai.generateButton') }}
      </UButton>
      <UPopover :content="{ side: 'top', align: 'end' }">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          square
          icon="mdi:information-outline"
          :aria-label="$t('articles.editor.ai.reservationLabel')"
        />
        <template #content>
          <div class="max-w-72 space-y-1 p-3 text-xs leading-5 text-muted">
            <p>{{ $t('articles.editor.ai.reservationSummary') }}</p>
            <p>{{ $t('articles.editor.ai.billingExplanation') }}</p>
          </div>
        </template>
      </UPopover>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import {
  ARTICLE_GENERATION_FORMATS,
  ARTICLE_GENERATION_MODULES,
  ARTICLE_GENERATION_DEFAULT_MODULES,
  RESEARCH_DEPTHS,
  type ArticleGenerationFormat,
  type ArticleGenerationOptions,
  type ArticleGenerationModule,
} from '~~/shared/utils/articleGeneration'

defineProps<{ aiGenerating: boolean }>()
defineEmits<{ generate: [] }>()

const customPrompt = defineModel<string>('customPrompt', { required: true })
const aiOptions = defineModel<ArticleGenerationOptions>('aiOptions', { required: true })
const { t } = useI18n()
const researchDepthName = useId()
const advancedOpen = shallowRef(false)

const formatItems = computed(() =>
  ARTICLE_GENERATION_FORMATS.map((value) => ({
    value,
    label: t(`articles.editor.ai.output.${value}`),
    description: t(`articles.editor.ai.outputDescription.${value}`),
  })),
)
const depthItems = computed(() =>
  RESEARCH_DEPTHS.map((value) => ({ value, label: t(`articles.editor.ai.depth.${value}`) })),
)
const MEDIA_MODULES: readonly ArticleGenerationModule[] = ['images', 'youtube']
const moduleItems = computed(() =>
  ARTICLE_GENERATION_MODULES.map((value) => ({ value, label: t(`articles.editor.ai.module.${value}`) })),
)
const advancedSummary = computed(() =>
  [
    aiOptions.value.research.enabled
      ? t(`articles.editor.ai.depth.${aiOptions.value.research.depth}`)
      : t('articles.editor.ai.researchOff'),
    aiOptions.value.useKnowledge !== false && t('articles.editor.ai.useKnowledge'),
    t('articles.editor.ai.modulesCount', aiOptions.value.modules.length),
  ]
    .filter(Boolean)
    .join(' · '),
)
// A format only proposes its content blocks; media stay as the author set them.
const selectFormat = (format: ArticleGenerationFormat) => {
  aiOptions.value.format = format
  aiOptions.value.modules = [
    ...ARTICLE_GENERATION_DEFAULT_MODULES[format],
    ...aiOptions.value.modules.filter((module) => MEDIA_MODULES.includes(module)),
  ]
}
</script>
