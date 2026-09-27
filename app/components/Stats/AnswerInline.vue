<template>
  <template v-for="(part, index) in parts" :key="index">
    <a
      v-if="part.href"
      :href="part.href"
      target="_blank"
      rel="noopener noreferrer nofollow"
      class="text-primary hover:underline"
      >{{ part.text }}</a
    >
    <strong v-else-if="part.bold" class="font-semibold text-highlighted">{{ part.text }}</strong>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<script setup lang="ts">
import type { AnswerInline } from '~~/shared/utils/answerMarkdown'

defineProps<{ parts: AnswerInline[] }>()
</script>
