<template>
  <UPopover :content="{ align: 'end', sideOffset: 8 }">
    <UButton
      color="neutral"
      variant="ghost"
      square
      class="relative"
      :aria-label="$t('articles.editor.toolbar.textColor')"
      icon="mdi:palette-outline"
    >
      <template #trailing>
        <span
          class="pointer-events-none absolute bottom-1 right-1 size-2 rounded-full ring-1 ring-default"
          :style="{ backgroundColor: modelValue || '#000000' }"
        />
      </template>
    </UButton>

    <template #content>
      <div class="w-72 space-y-4 p-4">
        <UFormField :label="$t('articles.editor.toolbar.textColor')" :ui="{ label: 'sr-only' }">
          <UColorPicker v-model="modelValue" class="w-full" />
        </UFormField>
        <USeparator />
        <div class="flex items-center justify-between gap-3 pt-3">
          <code class="text-sm text-muted">{{ (modelValue || '#000000').toUpperCase() }}</code>
          <UButton
            v-if="modelValue"
            color="error"
            variant="ghost"
            size="sm"
            :label="$t('articles.editor.toolbar.removeColor')"
            @click="modelValue = ''"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const modelValue = defineModel<string>()
</script>
