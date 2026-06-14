<template>
  <node-view-wrapper
    class="relative group flex flex-col gap-5 p-7 rounded-[1.25rem] border border-gray-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition-colors duration-250 max-w-[40rem] dark:border-gray-700 dark:bg-slate-900"
    contenteditable="false"
  >
    <Button
      square
      size="sm"
      variant="neutral"
      icon="mdi:close"
      class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity !text-gray-400 hover:!text-red-500 hover:!bg-red-50 border-none shadow-none"
      :title="$t('common.delete')"
      @click.stop.prevent="deleteNode"
      @mousedown.stop.prevent
    />

    <FormInput
      v-model="localQuestion"
      :placeholder="$t('articles.poll.questionPlaceholder')"
      class="w-full text-xl font-bold border-none border-b-2 border-transparent bg-transparent outline-none py-2 transition-colors duration-250 pr-8 focus:border-blue-600 dark:text-gray-100 dark:focus:border-blue-500 placeholder:text-gray-400"
      @input="syncQuestion"
      @click.stop
      @mousedown.stop
      @focus.stop
    />

    <div
      v-for="(opt, i) in localOptions"
      :key="i"
      class="flex items-center gap-3 border border-transparent rounded-xl px-4 py-3 bg-gray-50 transition-all duration-250 hover:border-gray-300 hover:shadow-sm dark:bg-slate-800 dark:border-slate-700"
    >
      <FormInput
        v-model="opt.label"
        :placeholder="$t('articles.poll.optionPlaceholder')"
        class="flex-1 bg-transparent border-none outline-none text-[0.95rem] text-inherit placeholder:text-gray-400 dark:text-gray-200"
        @input="syncOptions"
        @click.stop
        @mousedown.stop
        @focus.stop
      />

      <Button
        v-if="localOptions.length > 1"
        square
        size="sm"
        variant="neutral"
        icon="mdi:trash"
        class="!p-1.5 !w-8 !h-8 !text-red-500 hover:!bg-red-50 hover:scale-105 border-none shadow-none !bg-transparent"
        @click.stop.prevent="rm(i)"
        @mousedown.stop.prevent
      />
    </div>

    <Button
      variant="neutral"
      icon="mdi:plus"
      class="w-full !border-2 !border-dashed !border-gray-300 !text-gray-500 hover:!border-blue-500 hover:!text-blue-600 hover:!bg-blue-50/50 dark:!border-gray-600 dark:!text-gray-400 dark:hover:!border-blue-500 dark:hover:!text-blue-400 dark:hover:!bg-blue-900/20 shadow-none justify-center"
      @click.stop.prevent="add"
      @mousedown.stop.prevent
    >
      {{ $t('articles.poll.addOption') }}
    </Button>
  </node-view-wrapper>
</template>

<script setup>
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const { node, updateAttributes, deleteNode } = props

const defaultOption = () => ({ label: $t('articles.poll.defaultOption') })

const localQuestion = shallowRef(node.attrs.question || $t('articles.poll.defaultQuestion'))
const localOptions = shallowRef(
  node.attrs.options?.length ? node.attrs.options.map((o) => ({ ...o })) : [defaultOption()],
)
const localId = shallowRef(node.attrs.id || crypto.randomUUID())

const syncQuestion = () => {
  const question = localQuestion.value.trim() || $t('articles.poll.defaultQuestion')
  const validOptions = localOptions.value.length ? localOptions.value : [defaultOption()]
  updateAttributes({ question, id: localId.value, options: validOptions })
}

const syncOptions = () => {
  const validOptions = localOptions.value.length ? localOptions.value : [defaultOption()]
  localOptions.value = validOptions
  updateAttributes({
    question: localQuestion.value.trim() || $t('articles.poll.defaultQuestion'),
    id: localId.value,
    options: validOptions,
  })
}

const add = () => {
  localOptions.value = [...localOptions.value, { label: '' }]
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
    localQuestion.value = newVal || $t('articles.poll.defaultQuestion')
  },
)

watch(
  () => node.attrs.id,
  (newVal) => {
    localId.value = newVal || crypto.randomUUID()
  },
)
</script>
