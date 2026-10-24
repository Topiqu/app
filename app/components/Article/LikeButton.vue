<template>
  <UButton
    type="button"
    size="sm"
    :icon="liked ? 'mdi:heart' : 'mdi:heart-outline'"
    :color="liked ? 'error' : 'neutral'"
    :variant="variant ?? (liked ? 'soft' : 'outline')"
    :loading="pending"
    :disabled="pending"
    :square="iconOnly"
    :aria-pressed="liked"
    :aria-label="iconOnly ? $t('common.actions.like') : undefined"
    :title="$t(liked ? 'common.actions.unlike' : 'common.actions.like')"
    @click="$emit('toggle')"
  >
    <template v-if="!iconOnly">
      {{ $t('common.actions.like') }}
      <span v-if="likes > 0" class="tabular-nums">{{ formatNumber(likes) }}</span>
    </template>
  </UButton>
</template>

<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const { pending = false, iconOnly = false } = defineProps<{
  liked: boolean
  likes: number
  pending?: boolean
  iconOnly?: boolean
  variant?: ButtonProps['variant']
}>()

defineEmits<{ toggle: [] }>()
</script>
