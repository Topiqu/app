<template>
  <ul v-if="topics.length" class="space-y-2" data-website-topics>
    <li v-for="item in topics" :key="item.topic">
      <NuxtLink
        :to="editorLink(item)"
        class="block rounded-(--topiqu-surface-radius) border border-default p-3 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        data-website-topic
        @click="emit('navigate')"
      >
        <span class="block text-sm font-medium text-highlighted [overflow-wrap:anywhere]">{{ item.topic }}</span>
        <span class="mt-1 block text-xs leading-5 text-muted [overflow-wrap:anywhere]">{{ item.reason }}</span>
      </NuxtLink>
    </li>
  </ul>
</template>

<script setup lang="ts">
const emit = defineEmits<{ navigate: [] }>()
const topics = useWebsiteTopics()
const localePath = useLocalePath()
// The reason carries the angle, so the composer starts from both and the writer can still edit them.
const editorLink = ({ topic, reason }: WebsiteTopic) =>
  localePath({ name: 'admin-editor-id', params: { id: 'new' }, query: { ai: '1', prompt: `${topic}\n\n${reason}` } })
</script>
