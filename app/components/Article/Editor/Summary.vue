<template>
  <div class="flex flex-col gap-4">
    <UFormField
      v-if="answerShown"
      name="answer"
      :label="$t('articles.editor.summary.answer')"
      :help="$t('articles.editor.summary.answerHelp')"
    >
      <UTextarea
        :id="`${id}-answer`"
        v-model="answerText"
        name="answer"
        :maxlength="600"
        :rows="2"
        :disabled
        :placeholder="$t('articles.editor.summary.answerPlaceholder')"
        class="w-full"
        autoresize
      />
    </UFormField>

    <fieldset v-if="takeaways.length" class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-medium text-highlighted">{{ $t('articles.editor.summary.takeaways') }}</legend>
      <ol class="flex flex-col gap-2">
        <li v-for="(item, index) in takeaways" :key="index" class="flex items-start gap-2">
          <UInput
            :id="`${id}-takeaway-${index}`"
            :modelValue="item"
            :maxlength="500"
            :disabled
            :aria-label="$t('articles.editor.summary.takeaway', { n: index + 1 })"
            class="w-full"
            @update:modelValue="setTakeaway(index, String($event ?? ''))"
            @keydown.enter.prevent="!$event.isComposing && addTakeaway(index + 1)"
          />
          <UButton
            icon="mdi:delete-outline"
            color="neutral"
            variant="ghost"
            square
            :disabled
            :aria-label="$t('articles.editor.summary.removeTakeaway', { n: index + 1 })"
            @click="removeTakeaway(index)"
          />
        </li>
      </ol>
    </fieldset>

    <div v-if="!disabled && (!answerShown || takeaways.length < MAX_TAKEAWAYS)" class="flex flex-wrap gap-2">
      <UButton v-if="!answerShown" icon="mdi:plus" color="neutral" variant="soft" size="sm" @click="openAnswer">
        {{ $t('articles.editor.summary.addAnswer') }}
      </UButton>
      <UButton
        v-if="takeaways.length < MAX_TAKEAWAYS"
        icon="mdi:plus"
        color="neutral"
        variant="soft"
        size="sm"
        @click="addTakeaway(takeaways.length)"
      >
        {{ $t('articles.editor.summary.addTakeaway') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const MAX_TAKEAWAYS = 8

const answer = defineModel<string | null>('answer', { required: true })
// Replaced, never mutated in place: the parent snapshots the array before a save.
const takeaways = defineModel<string[]>('takeaways', { required: true })
const { disabled = false } = defineProps<{ disabled?: boolean }>()

const id = useId()
// Stays open once the author starts, so clearing the text does not pull the field away mid-edit.
const answerOpen = shallowRef(false)
const answerShown = computed(() => answerOpen.value || Boolean(answer.value))
const answerText = computed({
  get: () => answer.value ?? '',
  set: (value: string) => {
    answerOpen.value = true
    answer.value = value || null
  },
})

const focus = async (elementId: string) => {
  await nextTick()
  document.getElementById(elementId)?.focus()
}
const openAnswer = () => {
  answerOpen.value = true
  void focus(`${id}-answer`)
}
const setTakeaway = (index: number, value: string) => {
  takeaways.value = takeaways.value.map((item, at) => (at === index ? value : item))
}
const removeTakeaway = (index: number) => {
  takeaways.value = takeaways.value.filter((_, at) => at !== index)
}
const addTakeaway = (index: number) => {
  if (takeaways.value.length >= MAX_TAKEAWAYS) return
  takeaways.value = [...takeaways.value.slice(0, index), '', ...takeaways.value.slice(index)]
  void focus(`${id}-takeaway-${index}`)
}
</script>
