<template>
  <div class="relative space-y-2">
    <input
      v-model="password"
      :type="showPassword ? 'text' : 'password'"
      :placeholder="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')"
      :class="{ 'border-red-500 dark:border-red-500': !isValid && password }"
      class="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
    />
    <Icon
      :name="showPassword ? 'mdi:eye-off' : 'mdi:eye'"
      class="absolute right-3 top-3 sm:top-3.5 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer"
      @click="showPassword = !showPassword"
    />
    <div v-if="password" class="h-2 rounded bg-gray-200">
      <div :class="strengthColor" :style="{ width: passwordStrength + '%' }" class="h-2 rounded transition-all"></div>
    </div>
    <div v-if="password" class="text-xs text-right space-y-1">
      <p :class="passwordStrength < 40 ? 'text-red-500' : passwordStrength < 80 ? 'text-yellow-500' : 'text-green-500'">
        {{ strengthLabel }}
      </p>
      <p v-for="suggestion in suggestions" :key="suggestion" class="text-gray-600 dark:text-gray-400 italic">
        {{ suggestion }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { zxcvbn } from '@zxcvbn-ts/core'

defineProps<{
  isValid?: boolean
  isConfirm?: boolean
}>()

const { t } = useI18n()
const password = defineModel<string>({ default: '' })
const showPassword = ref(false)

const passwordAnalysis = computed(() => zxcvbn(password.value || ''))
const passwordStrength = computed(() => passwordAnalysis.value.score * 25)
const suggestions = computed(() =>
  passwordAnalysis.value.feedback.suggestions.map((s: string) => translateSuggestion(s)),
)
const strengthColor = computed(() => {
  const score = passwordStrength.value
  if (score < 40) return 'bg-red-500'
  if (score < 80) return 'bg-yellow-500'
  return 'bg-green-500'
})
const strengthLabel = computed(() => {
  const score = passwordStrength.value
  if (score < 40) return t('common.passwordSuggestions.weak')
  if (score < 80) return t('common.passwordSuggestions.medium')
  return t('common.passwordSuggestions.strong')
})

function translateSuggestion(suggestion: string): string {
  const suggestionKeys: Record<string, string> = {
    'Use a longer password.': 'common.passwordSuggestions.useLongerPassword',
    'Add another word or two. Uncommon words are better.': 'common.passwordSuggestions.addWords',
    'Use a few words, avoid common phrases.': 'common.passwordSuggestions.avoidCommonPhrases',
    'Avoid repeated words and characters.': 'common.passwordSuggestions.avoidRepeated',
    'Add some uppercase letters.': 'common.passwordSuggestions.addUppercase',
    'Add some lowercase letters.': 'common.passwordSuggestions.addLowercase',
    'Add some numbers.': 'common.passwordSuggestions.addNumbers',
    'Add some special characters.': 'common.passwordSuggestions.addSpecialChars',
    'Avoid dates and years that are associated with you.': 'common.passwordSuggestions.avoidDates',
    'Avoid common words and phrases.': 'common.passwordSuggestions.avoidCommonWords',
  }
  return t(suggestionKeys[suggestion] || suggestion)
}
</script>
