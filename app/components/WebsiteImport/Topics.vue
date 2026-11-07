<template>
  <ul v-if="topics.length" class="space-y-2" data-website-topics>
    <li v-for="item in topics" :key="item.topic">
      <UButton
        :to="editorLink(item)"
        color="neutral"
        variant="outline"
        block
        data-website-topic
        @click="emit('navigate')"
      >
        <span class="block w-full min-w-0 text-left">
          <span class="block text-sm font-medium text-highlighted [overflow-wrap:anywhere]">{{ item.topic }}</span>
          <span class="mt-1 block text-xs leading-5 font-normal text-muted [overflow-wrap:anywhere]">{{
            item.reason
          }}</span>
        </span>
      </UButton>
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
