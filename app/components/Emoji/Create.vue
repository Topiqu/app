<template>
  <Modal v-model="open" class="max-w-3xl" :title="$t('emoji.manage')" :onClose="confirmClose">
    <template #default="actions"><slot v-bind="actions" /></template>

    <template #content>
      <form class="mt-2 flex flex-col gap-5" @submit.prevent="submitQueue" @paste="onPaste">
        <div class="flex items-start gap-3">
          <div
            class="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"
          >
            <Icon name="mdi:emoticon-plus-outline" class="size-5" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ $t('emoji.addTitle') }}</h3>
            <p class="mt-1 max-w-xl text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {{ $t('emoji.addHint') }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="group flex min-h-24 w-full items-center gap-4 rounded-2xl border border-dashed px-5 py-4 text-left transition-colors"
          :class="
            isDragging
              ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30'
              : 'border-neutral-300 bg-neutral-50/70 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-neutral-700 dark:bg-neutral-800/40 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20'
          "
          @click="() => openPicker()"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <div
            class="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-500 shadow-sm ring-1 ring-neutral-200 transition-transform group-hover:-translate-y-0.5 dark:bg-neutral-800 dark:ring-neutral-700"
          >
            <Icon name="mdi:tray-arrow-up" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-neutral-800 dark:text-neutral-100">{{
              $t('emoji.dropTitle')
            }}</span>
            <span class="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{{ $t('emoji.dropHint') }}</span>
          </div>
          <Icon name="mdi:chevron-right" class="hidden size-5 text-neutral-400 sm:block" />
        </button>

        <div v-if="queue.length" class="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div class="rounded-2xl bg-neutral-100/70 p-2 dark:bg-neutral-800/50">
            <div class="flex items-center justify-between px-2 pb-2 pt-1">
              <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{{
                $t('emoji.queueTitle')
              }}</span>
              <span
                class="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-500 shadow-sm dark:bg-neutral-700 dark:text-neutral-300"
                >{{ queue.length }}</span
              >
            </div>
            <div class="max-h-72 space-y-1 overflow-y-auto">
              <div
                v-for="item in queue"
                :key="item.id"
                class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2 transition"
                :class="
                  selectedPreview?.id === item.id
                    ? 'bg-white shadow-sm dark:bg-neutral-700'
                    : 'hover:bg-white/70 dark:hover:bg-neutral-700/60'
                "
              >
                <button
                  type="button"
                  class="relative grid size-11 place-items-center rounded-lg bg-white ring-1 transition dark:bg-neutral-800"
                  :class="
                    selectedPreview?.id === item.id
                      ? 'ring-2 ring-indigo-500'
                      : 'ring-neutral-200 hover:ring-indigo-300 dark:ring-neutral-600'
                  "
                  :aria="$t('emoji.previewAria', { shortcode: item.shortcode })"
                  @click="selectedPreviewId = item.id"
                >
                  <img :src="item.previewUrl" :alt="item.shortcode" class="size-7 object-contain" />
                  <span
                    v-if="selectedPreview?.id === item.id"
                    class="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-indigo-500 text-white ring-2 ring-white dark:ring-neutral-700"
                    aria-hidden="true"
                  >
                    <Icon name="mdi:eye" class="size-2.5" />
                  </span>
                </button>

                <label class="min-w-0">
                  <input
                    v-model="item.shortcode"
                    maxlength="50"
                    :aria-label="$t('common.labels.shortcode')"
                    class="w-full rounded-lg bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none ring-1 ring-inset dark:bg-neutral-800 dark:text-neutral-100"
                    :class="
                      itemError(item)
                        ? 'ring-red-400'
                        : 'ring-neutral-200 focus:ring-2 focus:ring-indigo-400 dark:ring-neutral-600'
                    "
                    autocomplete="off"
                    @blur="normalizeItem(item)"
                    @input="resetItemError(item)"
                  />
                  <p
                    class="mt-1 truncate text-xs"
                    :class="itemError(item) ? 'text-red-500' : 'text-neutral-400 dark:text-neutral-500'"
                  >
                    {{ itemError(item) || `:${item.shortcode}:` }}
                  </p>
                </label>

                <Button
                  type="button"
                  square
                  size="sm"
                  variant="transparent"
                  icon="mdi:close"
                  :disabled="submitting"
                  :aria="$t('emoji.removeFromQueue')"
                  @click="removeQueued(item)"
                />
              </div>
            </div>
          </div>

          <EmojiCommentPreview
            v-if="selectedPreview"
            :imageUrl="selectedPreview.previewUrl"
            :shortcode="selectedPreview.shortcode || 'emoji'"
            :current="selectedPreviewIndex + 1"
            :total="queue.length"
            @previous="selectPreviousPreview"
            @next="selectNextPreview"
          />
        </div>
      </form>

      <section class="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ $t('emoji.libraryTitle') }}</h3>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ $t('emoji.libraryCount', { count: emojis?.length || 0 }) }}
            </p>
          </div>
          <label class="relative sm:w-64">
            <span class="sr-only">{{ $t('emoji.searchPlaceholder') }}</span>
            <Icon
              name="mdi:magnify"
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <input
              v-model="search"
              type="search"
              :placeholder="$t('emoji.searchPlaceholder')"
              class="w-full rounded-xl border-0 bg-neutral-100 py-2 pl-9 pr-3 text-sm text-neutral-800 ring-1 ring-inset ring-neutral-200 outline-none transition focus:ring-2 focus:ring-indigo-400 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700"
            />
          </label>
        </div>

        <div v-if="loading && !emojis?.length" class="py-8 text-center text-sm text-gray-500">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="error" class="py-8 text-center text-sm text-red-500">{{ $t('emoji.loadFailed') }}</div>
        <div
          v-else-if="filteredEmojis.length"
          class="mt-4 max-h-72 space-y-1 overflow-y-auto rounded-2xl bg-neutral-100/70 p-2 dark:bg-neutral-800/50"
        >
          <div
            v-for="emoji in filteredEmojis"
            :key="emoji.id"
            class="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-white hover:shadow-sm dark:hover:bg-neutral-700"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700"
              >
                <NuxtImg :src="emoji.imageUrl" :alt="emoji.shortcode" class="size-6 object-contain" />
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">:{{ emoji.shortcode }}:</p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  {{ $t('emoji.reactionCount', { count: emoji._count.emojiReactions }) }}
                </p>
              </div>
            </div>
            <Button
              type="button"
              square
              size="sm"
              variant="transparent"
              icon="mdi:delete-outline"
              class="text-red-500"
              :loading="deletingIds.has(emoji.id)"
              :aria="$t('emoji.deleteAria', { shortcode: emoji.shortcode })"
              @click="confirmDelete(emoji)"
            />
          </div>
        </div>
        <div
          v-else
          class="mt-4 rounded-xl border border-dashed px-3 py-8 text-center text-sm text-gray-500 dark:border-gray-700"
        >
          {{ search ? $t('emoji.noSearchResults') : $t('emoji.noEmojisFound') }}
        </div>
      </section>
    </template>

    <template #footer>
      <div class="mt-6 flex flex-shrink-0 justify-end gap-3 border-t pt-4">
        <Button type="button" variant="neutral" size="lg" :disabled="submitting" @click="confirmClose">{{
          $t('common.messages.deleteCancel')
        }}</Button>
        <Button :loading="submitting" :disabled="!canSubmit" @click="submitQueue">
          {{ queue.length > 1 ? $t('emoji.createMany', { count: queue.length }) : $t('emoji.create') }}
        </Button>
      </div>
    </template>
  </Modal>
  <ModalMini ref="dialog" />
</template>

<script setup lang="ts">
import { isValidEmojiShortcode, normalizeEmojiShortcode } from '#shared/utils/emoji'

interface QueuedEmoji {
  id: string
  file: File
  previewUrl: string
  shortcode: string
  errorMessage: string
}

interface EmojiRecord {
  id: string
  shortcode: string
  imageUrl: string
  _count: { emojiReactions: number }
}

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const toast = useToast()
const open = defineModel<boolean>()
const dialog = useTemplateRef<ModalMiniRef>('dialog')
const queue = ref<QueuedEmoji[]>([])
const selectedPreviewId = shallowRef('')
const search = shallowRef('')
const isDragging = shallowRef(false)
const submitting = shallowRef(false)
const deletingIds = reactive(new Set<string>())

const {
  open: openPicker,
  onChange,
  reset: resetPicker,
} = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp,image/gif',
  multiple: true,
})

const { data: emojis, pending: loading, error, refresh } = await useFetch<EmojiRecord[]>('/api/emojis')

const filteredEmojis = computed(() => {
  const query = normalizeEmojiShortcode(search.value)
  if (!query) return emojis.value || []
  return (emojis.value || []).filter((emoji) => emoji.shortcode.includes(query))
})

const existingShortcodes = computed(() => new Set((emojis.value || []).map((emoji) => emoji.shortcode)))
const selectedPreview = computed(
  () => queue.value.find((item) => item.id === selectedPreviewId.value) || queue.value[0] || null,
)
const selectedPreviewIndex = computed(() =>
  Math.max(
    0,
    queue.value.findIndex((item) => item.id === selectedPreview.value?.id),
  ),
)

const selectPreviewAt = (index: number) => {
  if (!queue.value.length) return
  const wrappedIndex = (index + queue.value.length) % queue.value.length
  selectedPreviewId.value = queue.value[wrappedIndex]!.id
}
const selectPreviousPreview = () => selectPreviewAt(selectedPreviewIndex.value - 1)
const selectNextPreview = () => selectPreviewAt(selectedPreviewIndex.value + 1)

const itemError = (item: QueuedEmoji) => {
  if (item.errorMessage) return item.errorMessage
  if (!item.shortcode) return $t('emoji.shortcodeRequired')
  if (!isValidEmojiShortcode(item.shortcode)) return $t('emoji.invalidShortcode')
  if (existingShortcodes.value.has(item.shortcode)) return $t('emoji.duplicateShortcode')
  if (queue.value.some((other) => other.id !== item.id && other.shortcode === item.shortcode))
    return $t('emoji.duplicateInQueue')
  return ''
}

const canSubmit = computed(() => queue.value.length > 0 && queue.value.every((item) => !itemError(item)))

const uniqueShortcode = (filename: string) => {
  const base = normalizeEmojiShortcode(filename) || 'emoji'
  const taken = new Set([...existingShortcodes.value, ...queue.value.map((item) => item.shortcode)])
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base.slice(0, 50 - String(suffix).length - 1)}-${suffix}`)) suffix++
  return `${base.slice(0, 50 - String(suffix).length - 1)}-${suffix}`
}

const addFiles = (files: File[]) => {
  for (const file of files) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      toast.error({ message: $t('emoji.unsupportedFile', { name: file.name }) })
      continue
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error({ message: $t('emoji.fileTooLarge', { name: file.name }) })
      continue
    }
    const item = {
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      shortcode: uniqueShortcode(file.name),
      errorMessage: '',
    }
    queue.value.push(item)
    if (!selectedPreviewId.value) selectedPreviewId.value = item.id
  }
  resetPicker()
}

const onDrop = (event: DragEvent) => {
  isDragging.value = false
  addFiles(Array.from(event.dataTransfer?.files || []))
}

const onPaste = (event: ClipboardEvent) => {
  const files = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
  if (!files.length) return
  event.preventDefault()
  addFiles(files)
}

onChange((files) => files?.length && addFiles(Array.from(files)))

const normalizeItem = (item: QueuedEmoji) => {
  item.shortcode = normalizeEmojiShortcode(item.shortcode)
  item.errorMessage = ''
}
const resetItemError = (item: QueuedEmoji) => (item.errorMessage = '')

const removeQueued = (item: QueuedEmoji) => {
  URL.revokeObjectURL(item.previewUrl)
  queue.value = queue.value.filter((candidate) => candidate.id !== item.id)
  if (selectedPreviewId.value === item.id) selectedPreviewId.value = queue.value[0]?.id || ''
}

const submitQueue = async () => {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  const createdNames: string[] = []

  for (const item of [...queue.value]) {
    try {
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('shortcode', item.shortcode)
      await $fetch('/api/emojis', { method: 'POST', body: formData })
      createdNames.push(item.shortcode)
      removeQueued(item)
    } catch (requestError: any) {
      item.errorMessage = requestError.data?.message || requestError.data?.statusMessage || $t('emoji.createFailed')
    }
  }

  submitting.value = false
  if (createdNames.length) {
    await refresh()
    toast.success({
      message:
        createdNames.length === 1
          ? $t('emoji.createSuccess', [createdNames[0]])
          : $t('emoji.createManySuccess', { count: createdNames.length }),
    })
  }
}

const confirmDelete = async (emoji: EmojiRecord) => {
  const result = await dialog.value?.ask({
    title: $t('emoji.deleteTitle', { shortcode: emoji.shortcode }),
    message: $t('emoji.deleteConfirm', { count: emoji._count.emojiReactions }),
    icon: 'mdi:alert-outline',
    confirmText: $t('emoji.deleteAction'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (result !== 'ok') return

  deletingIds.add(emoji.id)
  try {
    await $fetch(`/api/emojis/${emoji.id}` as `/api/emojis/:id`, { method: 'DELETE' })
    toast.success({ message: $t('emoji.deleteSuccess') })
    await refresh()
  } catch (requestError: any) {
    toast.error({ message: requestError.data?.message || $t('emoji.deleteFailed') })
  } finally {
    deletingIds.delete(emoji.id)
  }
}

const discardQueue = () => {
  queue.value.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  queue.value = []
  selectedPreviewId.value = ''
}

const confirmClose = async () => {
  if (!queue.value.length) return (open.value = false)
  const result = await dialog.value?.ask({
    title: $t('common.messages.closeConfirmTitle'),
    message: $t('emoji.closeConfirm', { count: queue.value.length }),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.messages.closeConfirmButton'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (result === 'ok') {
    discardQueue()
    open.value = false
  }
}

onBeforeUnmount(discardQueue)
</script>
