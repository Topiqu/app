<template>
  <UAlert color="warning" variant="soft" icon="mdi:robot-outline" :title="$t('articles.editor.releaseHold.title')">
    <template #description>
      <p>{{ $t('articles.editor.releaseHold.description') }}</p>
      <ul class="mt-2 list-disc space-y-1 ps-5">
        <li v-for="reason in hold.reasons" :key="reason">
          {{ $t(`articles.editor.releaseHold.reason.${reason}`) }}
          <ul v-if="reason === 'review' && hold.issues.length" class="mt-1 space-y-1 text-xs leading-5">
            <li v-for="(issue, index) in hold.issues" :key="index">
              <span class="font-medium text-highlighted">{{ issueLabel(issue.code) }}:</span> {{ issueNote(issue) }}
            </li>
          </ul>
        </li>
      </ul>
    </template>
    <template #actions>
      <UButton size="sm" color="warning" :loading="pending" @click="emit('publish')">
        {{ $t('articles.editor.releaseHold.publish') }}
      </UButton>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
import type { ReleaseHold } from '~~/shared/utils/articleGeneration'

const { hold, pending = false } = defineProps<{ hold: ReleaseHold; pending?: boolean }>()
const emit = defineEmits<{ publish: [] }>()

const { issueLabel, issueNote } = useReviewIssueText()
</script>
