<template>
  <div class="relative space-y-2">
    <FormLabel :text="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')" />
    <FormInput
      v-model="password"
      :type="showPassword ? 'text' : 'password'"
      :placeholder="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')"
      class="w-full rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all duration-300"
      :class="{
        'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-neutral-700': !password,
        '!border-green-500 dark:border-green-500 bg-gray-100 dark:bg-neutral-700':
          password && isValidReal && !isConfirm,
        '!border-red-500 dark:border-red-500 bg-gray-100 dark:bg-neutral-700': password && !isValidReal && !isConfirm,
      }"
    >
      <template #icon>
        <div
          class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-6 text-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer"
          :aria-label="showPassword ? $t('common.hidePassword') : $t('common.showPassword')"
          @click="showPassword = !showPassword"
        >
          <Icon :name="showPassword ? 'mdi:eye-off' : 'mdi:eye'" class="size-full text-[inherit]" />
        </div>
      </template>
    </FormInput>

    <div v-if="password && !isConfirm" class="space-y-2">
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
const passwordAnalysis = computed(() =>
  props.isConfirm ? { score: 0, feedback: { suggestions: [] } } : zxcvbn(password.value || ''),
)

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
  if (props.isConfirm) return props.isValid ?? true
  const externalValid = props.isValid ?? true
  const scoreValid = passwordAnalysis.value.score >= 3
  const minLength = props.minLength ?? getFallbackMinLength()
  const maxLength = props.maxLength ?? getFallbackMaxLength()
  const lengthValid = password.value.length >= minLength && password.value.length <= maxLength
  return externalValid && scoreValid && lengthValid
})

const suggestions = computed(() => {
  if (props.isConfirm) return []
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
  if (props.isConfirm) return ''
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return $t('common.passwordSuggestions.weak')
  if (sc === 2) return $t('common.passwordSuggestions.medium')
  if (sc === 3) return $t('common.passwordSuggestions.strong')
  if (sc >= 4) return $t('common.passwordSuggestions.veryStrong')
  return ''
})

const labelColor = computed(() => {
  if (props.isConfirm) return 'text-gray-400'
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return 'text-red-500'
  if (sc === 2) return 'text-yellow-500'
  if (sc === 3) return 'text-green-500'
  if (sc >= 4) return 'text-green-700'
  return 'text-gray-400'
})

function segmentClass(n: number): string {
  if (props.isConfirm) return 'bg-gray-300 dark:bg-neutral-700'
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
