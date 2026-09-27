<template>
  <div class="space-y-3 text-sm leading-6 text-default">
    <template v-for="(block, index) in blocks" :key="index">
      <hr v-if="block.type === 'rule'" class="border-default" />
      <p v-else-if="block.type === 'heading'" class="pt-1 font-semibold text-highlighted">
        <StatsAnswerInline :parts="block.inline" />
      </p>
      <component
        :is="block.ordered ? 'ol' : 'ul'"
        v-else-if="block.type === 'list'"
        class="space-y-1 pl-5"
        :class="block.ordered ? 'list-decimal' : 'list-disc'"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <StatsAnswerInline :parts="item" />
        </li>
      </component>
      <p v-else class="text-muted">
        <StatsAnswerInline :parts="block.inline" />
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { parseAnswerMarkdown } from '~~/shared/utils/answerMarkdown'

const { text } = defineProps<{ text: string }>()
const blocks = computed(() => parseAnswerMarkdown(text))
</script>
