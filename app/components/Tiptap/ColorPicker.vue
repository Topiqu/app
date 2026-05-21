<template>
  <Popover class="relative">
    <Float :placement="'bottom-end'" :offset="8" portal>
      <PopoverButton
        :title="$t('articles.editor.toolbar.textColor')"
        :aria-label="$t('articles.editor.toolbar.textColor')"
        class="color-swatch w-9 h-9 cursor-pointer border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        :style="{ backgroundColor: modelValue || '#000000' }"
      />

      <PopoverPanel
        v-slot="{ close }"
        class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-2xl rounded-2xl p-3 z-[9999] w-56 flex flex-col gap-3"
      >
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="c in swatches"
            :key="c"
            type="button"
            :title="c"
            :aria-label="c"
            :class="[
              'w-8 h-8 rounded-lg border transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500',
              modelValue?.toUpperCase() === c.toUpperCase() ? 'ring-2 ring-indigo-500 scale-110' : 'border-gray-300',
            ]"
            :style="{ backgroundColor: c }"
            @click="(modelValue = c), close()"
          />
        </div>

        <div class="flex items-center gap-2">
          <input
            type="color"
            class="color-swatch w-8 h-8 cursor-pointer border border-gray-300"
            :value="modelValue || '#000000'"
            :aria-label="$t('articles.editor.toolbar.textColor')"
            @input="modelValue = ($event.target as HTMLInputElement).value"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ modelValue || '#000000' }}</span>
        </div>

        <Button v-if="modelValue" size="sm" variant="neutral" icon="mdi:close" @click="(modelValue = ''), close()">
          {{ $t('articles.editor.toolbar.removeColor') }}
        </Button>
      </PopoverPanel>
    </Float>
  </Popover>
</template>

<script setup lang="ts">
import { Float } from '@headlessui-float/vue'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'

const modelValue = defineModel<string>()

const swatches = [
  '#000000',
  '#374151',
  '#6B7280',
  '#9CA3AF',
  '#FFFFFF',
  '#EF4444',
  '#F59E0B',
  '#EAB308',
  '#22C55E',
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
]
</script>

<style scoped>
.color-swatch {
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
  border-radius: 9999px;
  overflow: hidden;
}
.color-swatch::-webkit-color-swatch-wrapper {
  padding: 0;
  border-radius: 9999px;
}
.color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 9999px;
}
.color-swatch::-moz-color-swatch {
  border: none;
  border-radius: 9999px;
}
</style>
