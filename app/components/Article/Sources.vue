<template>
  <div class="flex flex-col gap-3">
    <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
      {{ $t('articles.columns.sources') }}
    </span>
    <div class="flex flex-col gap-3">
      <transition-group name="fade" tag="div" class="flex flex-col gap-2">
        <div
          v-for="(source, index) in sources"
          :key="index"
          class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700"
        >
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 w-6 text-center">{{ index + 1 }}.</span>
          <div class="flex items-center gap-2 flex-1">
            <input
              v-model="sources[index]"
              :placeholder="$t('articles.sources.placeholder')"
              class="flex-1 p-3 rounded-lg text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-800 transition-all"
              :class="{ 'border-red-500': sources[index] && !isValidURL(sources[index]) }"
              @blur="sanitizeSource(index)"
              @keyup.enter="addSourceIfValid(index)"
            />
            <div v-if="sources[index]" class="flex items-center gap-2 min-w-[120px]">
              <img
                :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${sources[index]}&size=32`"
                class="w-5 h-5 rounded-sm"
                alt="favicon"
              />
              <span class="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                {{ extractDomain(sources[index]) }}
              </span>
            </div>
          </div>
          <Button
            icon="mdi:delete"
            variant="danger"
            class="!p-2 text-gray-500 hover:text-red-500 transition-colors"
            :title="$t('common.actions.delete')"
            @click="removeSource(index)"
          />
        </div>
      </transition-group>
      <Button
        icon="mdi:plus"
        variant="secondary"
        size="sm"
        class="self-start mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
        :title="$t('articles.tags.addButton')"
        @click="addSource"
      >
        {{ $t('articles.tags.addButton') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const sources = defineModel<string[]>({ default: [] })

const extractDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const isValidURL = (str: string) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

const sanitizeSource = (index: number) => {
  let url = sources.value[index]?.trim()
  if (!url) return
  if (!url.startsWith('http')) url = 'https://' + url
  sources.value[index] = url
}

const addSource = () => {
  sources.value.push('')
}

const addSourceIfValid = (index: number) => {
  const last = sources.value[index]
  if (last && last.trim().length > 5 && isValidURL(last)) addSource()
}

const removeSource = (index: number) => {
  sources.value.splice(index, 1)
}

watch(
  () => sources.value,
  (val) => {
    const last = val[val.length - 1]
    if (last && last.trim().length > 5 && isValidURL(last) && !val[val.length]) addSource()
  },
  { deep: true },
)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
