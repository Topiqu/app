<template>
  <div
    class="flex flex-col gap-6 p-6 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
  >
    <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
      <Icon name="mdi:robot" class="w-5 h-5" />
      {{ $t('common.preferences.aiAuthor.title') }}
    </h3>

    <FormField
      v-model="username"
      :label="$t('common.preferences.aiAuthor.username.label')"
      :placeholder="$t('common.preferences.aiAuthor.username.placeholder')"
      type="text"
    />

    <div class="flex flex-col gap-2">
      <FormLabel :text="$t('common.avatar.ai.label')" />
      <FileUploader :imageUrl="avatarUrl" type="user-avatar" :isAiUser="true" @upload="avatarUrl = $event.url" />
    </div>

    <div class="flex flex-col gap-2">
      <FormLabel :text="$t('common.preferences.aiAuthor.bio.label')" />
      <FormField
        v-model="bio"
        type="textarea"
        :placeholder="$t('common.preferences.aiAuthor.bio.placeholder')"
        :maxLength="300"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  username: string
  bio: string
  avatarUrl: string
}>()

const emit = defineEmits<{
  'update:username': [string]
  'update:bio': [string]
  'update:avatarUrl': [string]
}>()

const username = computed({
  get: () => props.username,
  set: (v) => emit('update:username', v),
})

const bio = computed({
  get: () => props.bio,
  set: (v) => emit('update:bio', v),
})

const avatarUrl = computed({
  get: () => props.avatarUrl,
  set: (v) => emit('update:avatarUrl', v),
})
</script>
