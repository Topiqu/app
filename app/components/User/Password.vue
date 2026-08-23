<template>
  <div class="relative space-y-2">
    <UFormField :label="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')">
      <UInput
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="$t(isConfirm ? 'common.auth.passwordConfirm' : 'common.auth.newPassword')"
        class="w-full"
        :color="password && !isConfirm ? (isValidReal ? 'success' : 'error') : 'neutral'"
      >
        <template #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            :icon="showPassword ? 'i-mdi-eye-off' : 'i-mdi-eye'"
            :aria-label="showPassword ? $t('common.hidePassword') : $t('common.showPassword')"
            @click="showPassword = !showPassword"
          />
        </template>
      </UInput>
    </UFormField>

    <div v-if="password && !isConfirm" class="space-y-2">
      <UProgress :modelValue="passwordAnalysis.score" :max="4" :color="strengthColor" />

      <div class="text-xs text-right space-y-1" aria-live="polite">
        <UBadge :color="strengthColor" variant="soft">{{ strengthLabel }}</UBadge>
        <div v-for="s in suggestions" :key="s" class="italic text-muted">
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

const strengthColor = computed<'error' | 'warning' | 'success' | 'neutral'>(() => {
  if (props.isConfirm) return 'neutral'
  const sc = passwordAnalysis.value.score
  if (sc <= 1) return 'error'
  if (sc === 2) return 'warning'
  return 'success'
})

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
