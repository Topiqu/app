<template>
  <node-view-wrapper class="poll-node" contenteditable="false">
    <input
      v-model="localQuestion"
      placeholder="Zadej otázku"
      class="question"
      @input="syncQuestion"
      @click.stop
      @mousedown.stop
      @focus.stop
    />
    <div v-for="(opt, i) in localOptions" :key="i" class="poll-option">
      <input
        v-model="localOptions[i]"
        placeholder="Možnost"
        @input="syncOptions"
        @click.stop
        @mousedown.stop
        @focus.stop
      />
      <button v-if="localOptions.length > 1" class="remove-btn" @click.stop="rm(i)">
        <mdi:minus />
      </button>
    </div>
    <button class="add-btn" @click.stop="add">
      <mdi:plus class="icon" />
      Přidat možnost
    </button>
  </node-view-wrapper>
</template>

<script setup>
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)
const { node, updateAttributes } = props

const localQuestion = ref(node.attrs.question || '')
const localOptions = ref([...(node.attrs.options || [''])])
const localId = ref(node.attrs.id || crypto.randomUUID())

const syncQuestion = () => {
  updateAttributes({ question: localQuestion.value, id: localId.value, options: localOptions.value })
}

const syncOptions = () => {
  const validOptions = localOptions.value.filter((opt) => opt.trim() !== '')
  if (validOptions.length === 0) validOptions.push('')
  updateAttributes({ question: localQuestion.value, id: localId.value, options: validOptions })
}

const add = () => {
  localOptions.value.push('')
  syncOptions()
}

const rm = (i) => {
  if (localOptions.value.length <= 1) return
  localOptions.value = localOptions.value.filter((_, idx) => idx !== i)
  syncOptions()
}

watch(
  () => node.attrs.question,
  (newVal) => {
    localQuestion.value = newVal || ''
  },
)

watch(
  () => node.attrs.options,
  (newVal) => {
    localOptions.value = [...(newVal || [''])]
  },
  { deep: true },
)

watch(
  () => node.attrs.id,
  (newVal) => {
    localId.value = newVal || crypto.randomUUID()
  },
)
</script>

<style>
.poll-node {
  border-radius: 1rem;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition:
    background-color 0.2s,
    border-color 0.2s;
}
html.dark .poll-node {
  border-color: #374151;
  background-color: #111827;
}
.poll-node input.question {
  width: 100%;
  font-size: 1.15rem;
  font-weight: 600;
  border: none;
  border-bottom: 2px solid #e5e7eb;
  background-color: transparent;
  outline: none;
  padding: 0.5rem 0;
  transition: border-color 0.2s;
}
.poll-node input.question:focus {
  border-bottom-color: #2563eb;
}
html.dark .poll-node input.question {
  border-bottom-color: #4b5563;
}
.poll-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}
.poll-option:hover {
  border-color: #d1d5db;
}
html.dark .poll-option {
  background-color: #1f2937;
  border-color: #4b5563;
}
.poll-option input {
  flex: 1;
  background-color: transparent;
  border: none;
  outline: none;
  font-size: 0.95rem;
  color: inherit;
}
.remove-btn {
  border: none;
  background-color: #f3f4f6;
  color: #374151;
  border-radius: 0.5rem;
  padding: 0.4rem 0.55rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.remove-btn:hover {
  background-color: #e5e7eb;
}
html.dark .remove-btn {
  background-color: #4b5563;
  color: #f9fafb;
}
html.dark .remove-btn:hover {
  background-color: #6b7280;
}
.add-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.75rem;
  padding: 0.85rem;
  color: #6b7280;
  background-color: transparent;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}
.add-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}
html.dark .add-btn {
  border-color: #4b5563;
  color: #9ca3af;
}
html.dark .add-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}
.add-btn .icon {
  font-size: 1.2rem;
}
</style>
