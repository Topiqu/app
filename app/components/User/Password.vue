<template>
  <div class="relative space-y-2">
    <div class="relative flex items-center">
      <input
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')"
        :class="{ 'border-red-500 dark:border-red-500': !isValid && password }"
        class="w-full pl-5 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
      />
      <div
        class="absolute right-3 inset-y-0 flex items-center"
        :aria-label="showPassword ? $t('common.hidePassword') : $t('common.showPassword')"
        @click="showPassword = !showPassword"
      >
        <Icon
          :name="showPassword ? 'mdi:eye-off' : 'mdi:eye'"
          class="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
        />
      </div>
    </div>

    <div v-if="password" class="space-y-2">
      <div class="flex gap-1">
        <div v-for="n in 4" :key="n" class="flex-1 h-2 rounded transition-all" :class="segmentClass(n)" />
      </div>

      <div class="text-xs text-right space-y-1" aria-live="polite">
        <p :class="labelColor">{{ strengthLabel }}</p>
        <p v-if="passwordAnalysis.feedback.warning" class="text-sm text-red-500">
          {{ passwordAnalysis.feedback.warning }}
        </p>
        <div v-for="s in suggestions" :key="s" class="text-gray-600 dark:text-gray-400 italic">
          {{ s }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { zxcvbn } from '@zxcvbn-ts/core'

defineProps<{ isValid?: boolean; isConfirm?: boolean }>()
const password = defineModel<string>({ default: '' })
const showPassword = shallowRef(false)
const passwordAnalysis = computed(() => zxcvbn(password.value || ''))

const suggestions = computed(() => {
  const rawSuggestions = passwordAnalysis.value.feedback.suggestions || []
  const mappedSuggestions = rawSuggestions.map((s) => translateSuggestion(s))
  return mappedSuggestions
})

const strengthLabel = computed(() => {
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return $t('common.passwordSuggestions.weak')
  if (sc === 2) return $t('common.passwordSuggestions.medium')
  return $t('common.passwordSuggestions.strong')
})

const labelColor = computed(() => {
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return 'text-red-500'
  if (sc === 2) return 'text-yellow-500'
  return 'text-green-500'
})

function segmentClass(n: number): string {
  const sc = passwordAnalysis.value.score
  if (sc <= 1 && n === 1) return 'bg-red-500'
  if (sc === 2 && n <= 2) return 'bg-yellow-500'
  if (sc === 3 && n <= 3) return 'bg-green-500'
  if (sc >= 4 && n <= 4) return 'bg-green-800'
  return 'bg-gray-300 dark:bg-neutral-700'
}

function translateSuggestion(s: string): string {
  if (!s) return ''
  const trimmed = s.trim()
  const keyMap: Record<string, string> = {
    anotherWord: 'common.passwordSuggestions.addWords',
    recentYears: 'common.passwordSuggestions.avoidRecentYears',
    associatedYears: 'common.passwordSuggestions.avoidDates',
    repeated: 'common.passwordSuggestions.avoidRepeated',
    sequences: 'common.passwordSuggestions.avoidSequences',
    fewWords: 'common.passwordSuggestions.useFewWordsAvoidCommonPhrases',
    noSymbols: 'common.passwordSuggestions.noNeedForSymbols',
    capitalization: 'common.passwordSuggestions.capitalization',
    allUppercase: 'common.passwordSuggestions.allUppercase',
    reversedWords: 'common.passwordSuggestions.reversedWords',
    predictableSubstitutions: 'common.passwordSuggestions.predictableSubstitutions',
    keyboardPattern: 'common.passwordSuggestions.useLongerKeyboardPattern',
    extendedRepeat: 'common.passwordSuggestions.avoidExtendedRepeat',
  }
  const translationKey = keyMap[trimmed]
  if (translationKey) {
    const translated = $t(translationKey)
    return translated
  }
  return trimmed
}
</script>
