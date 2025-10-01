<template>
  <div class="relative space-y-2">
    <div class="relative flex items-center">
      <input
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')"
        class="w-full pl-5 pr-10 py-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all duration-300"
        :class="{
          'border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800': !password,
          '!border-green-500 dark:border-green-500': password && isValidReal,
          '!border-red-500 dark:border-red-500': password && !isValidReal,
        }"
      />
      <div
        class="absolute right-3 inset-y-0 flex items-center"
        :aria-label="showPassword ? $t('common.hidePassword') : $t('common.showPassword')"
        @click="showPassword = !showPassword"
      >
        <Icon
          :name="showPassword ? 'mdi:eye-off' : 'mdi:eye'"
          class="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer"
        />
      </div>
    </div>

    <div v-if="password" class="space-y-2">
      <div class="flex gap-1">
        <div v-for="n in 4" :key="n" class="flex-1 h-2 rounded transition-all duration-300" :class="segmentClass(n)" />
      </div>

      <div class="text-xs text-right space-y-1" aria-live="polite">
        <p :class="labelColor">{{ strengthLabel }}</p>
        <div v-for="s in suggestions" :key="s" class="text-gray-600 dark:text-gray-400 italic">
          {{ s }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { zxcvbn } from '@zxcvbn-ts/core'
import { signInSchema } from '~~/shared/utils/auth'

const props = defineProps<{
  isValid?: boolean
  isConfirm?: boolean
  minLength?: number
  maxLength?: number
}>()

const password = defineModel<string>({ default: '', required: true })
const showPassword = shallowRef(false)
const passwordAnalysis = computed(() => zxcvbn(password.value || ''))

const getFallbackMinLength = (): number => {
  const result = signInSchema.shape.password.safeParse('')
  const issue = result.error?.issues.find((i) => i.code === 'too_small')
  return issue ? Number(issue.minimum) : 4
}

const getFallbackMaxLength = (): number => {
  const result = signInSchema.shape.password.safeParse('a'.repeat(125))
  const issue = result.error?.issues.find((i) => i.code === 'too_big')
  return issue ? Number(issue.maximum) : 124
}

const isValidReal = computed(() => {
  const externalValid = props.isValid ?? true
  const scoreValid = passwordAnalysis.value.score >= 3
  const minLength = props.minLength ?? getFallbackMinLength()
  const maxLength = props.maxLength ?? getFallbackMaxLength()
  const lengthValid = password.value.length >= minLength && password.value.length <= maxLength
  return externalValid && scoreValid && lengthValid
})

const suggestions = computed(() => {
  const rawSuggestions = passwordAnalysis.value.feedback.suggestions || []
  const minLength = props.minLength ?? getFallbackMinLength()
  const maxLength = props.maxLength ?? getFallbackMaxLength()
  if (password.value.length < minLength) {
    return [$t('common.passwordSuggestions.tooShort', { minLength }), ...rawSuggestions.map(translateSuggestion)]
  }
  if (password.value.length > maxLength) {
    return [$t('common.passwordSuggestions.tooLong', { maxLength }), ...rawSuggestions.map(translateSuggestion)]
  }
  return rawSuggestions.map(translateSuggestion)
})

const strengthLabel = computed(() => {
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return $t('common.passwordSuggestions.weak')
  if (sc === 2) return $t('common.passwordSuggestions.medium')
  if (sc === 3) return $t('common.passwordSuggestions.strong')
  if (sc >= 4) return $t('common.passwordSuggestions.veryStrong')
  return ''
})

const labelColor = computed(() => {
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return 'text-red-500'
  if (sc === 2) return 'text-yellow-500'
  if (sc === 3) return 'text-green-500'
  if (sc >= 4) return 'text-green-700'
  return 'text-gray-400'
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
    fewWords: 'common.passwordSuggestions.avoidCommonPhrases',
    repeated: 'common.passwordSuggestions.avoidSequences',
    sequences: 'common.passwordSuggestions.avoidSequences',
    dates: 'common.passwordSuggestions.avoidDates',
  }
  const translationKey = keyMap[trimmed]
  return translationKey ? $t(translationKey) : trimmed
}
</script>
