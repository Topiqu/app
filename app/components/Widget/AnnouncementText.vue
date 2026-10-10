<template>
  <template v-if="runs?.length">
    <template v-for="(run, index) in runs" :key="index">
      <a
        v-if="run.url"
        :href="run.url"
        :target="run.url?.startsWith('https://') ? '_blank' : undefined"
        rel="noopener noreferrer"
        class="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-current"
      >
        <strong v-if="run.bold" class="font-bold"
          ><em v-if="run.italic" class="italic">{{ run.text }}</em
          ><template v-else>{{ run.text }}</template></strong
        >
        <em v-else-if="run.italic" class="italic">{{ run.text }}</em>
        <template v-else>{{ run.text }}</template>
      </a>
      <strong v-else-if="run.bold" class="font-bold"
        ><em v-if="run.italic" class="italic">{{ run.text }}</em
        ><template v-else>{{ run.text }}</template></strong
      >
      <em v-else-if="run.italic" class="italic">{{ run.text }}</em>
      <template v-else>{{ run.text }}</template>
    </template>
  </template>
  <template v-else>{{ text }}</template>
</template>

<script setup lang="ts">
import type { AnnouncementTextRun } from '~~/shared/utils/widgets'

defineProps<{ text: string; runs?: AnnouncementTextRun[] | null }>()
</script>
