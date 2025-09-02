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
        <Icon name="mdi:trash" class="remove-icon" />
      </button>
    </div>
    <button class="add-btn" @click.stop="add">
      <Icon name="mdi:plus" />
      Přidat možnost
    </button>
  </node-view-wrapper>
</template>

<script setup>
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)
const { node, updateAttributes } = props

const localQuestion = ref(node.attrs.question || 'Zadej otázku')
const localOptions = ref([...(node.attrs.options?.length ? node.attrs.options : ['Možnost 1'])])
const localId = ref(node.attrs.id || crypto.randomUUID())

const syncQuestion = () => {
  const question = localQuestion.value.trim() || 'Zadej otázku'
  const validOptions = localOptions.value.length ? localOptions.value : ['Možnost 1']
  updateAttributes({ question, id: localId.value, options: validOptions })
}

const syncOptions = () => {
  const validOptions = localOptions.value.length ? localOptions.value : ['Možnost 1']
  localOptions.value = validOptions
  updateAttributes({
    question: localQuestion.value.trim() || 'Zadej otázku',
    id: localId.value,
    options: validOptions,
  })
}

const add = () => {
  localOptions.value = [...localOptions.value, '']
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
    localQuestion.value = newVal || 'Zadej otázku'
  },
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
  border-radius: 1.25rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  transition:
    background-color 0.25s,
    border-color 0.25s;
  max-width: 40rem;
}

html.dark .poll-node {
  border-color: #374151;
  background-color: #0f172a;
}

.poll-node input.question {
  width: 100%;
  font-size: 1.25rem;
  font-weight: 700;
  border: none;
  border-bottom: 2px solid transparent;
  background-color: transparent;
  outline: none;
  padding: 0.5rem 0;
  transition: border-color 0.25s;
}

.poll-node input.question:focus {
  border-bottom-color: #2563eb;
}

html.dark .poll-node input.question:focus {
  border-bottom-color: #3b82f6;
}

.poll-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  padding: 0.8rem 1rem;
  background-color: #f9fafb;
  transition:
    border-color 0.25s,
    background-color 0.25s,
    box-shadow 0.25s;
}

.poll-option:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

html.dark .poll-option {
  background-color: #1e293b;
  border-color: #334155;
}

.poll-option input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.95rem;
  color: inherit;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent !important;
  border: none !important;
  border-radius: 0.5rem;
  padding: 0.45rem;
  font-size: 1.5rem;
  cursor: pointer;
  transition:
    background-color 0.25s,
    transform 0.15s;
}

.remove-icon {
  color: red !important;
}

.remove-btn:hover {
  background-color: #fee2e2;
  transform: scale(1.05);
}

html.dark .remove-btn {
  background-color: #334155;
}

html.dark .remove-btn:hover {
  background-color: #7f1d1d;
}

.add-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  border: 2px dashed #cbd5e1;
  border-radius: 0.75rem;
  padding: 0.9rem;
  color: #6b7280;
  background-color: transparent;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.25s;
}

.add-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
  background-color: #f0f9ff;
}

html.dark .add-btn {
  border-color: #475569;
  color: #94a3b8;
}

html.dark .add-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background-color: #1e3a8a40;
}

.add-btn .icon {
  font-size: 1.2rem;
}
</style>
