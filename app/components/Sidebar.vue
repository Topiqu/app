<template>
  <transition
    enterActiveClass="transition transform duration-300 ease-out"
    enterFromClass="-translate-x-full"
    enterToClass="translate-x-0"
    leaveActiveClass="transition transform duration-300 ease-in"
    leaveFromClass="translate-x-0"
    leaveToClass="-translate-x-full"
  >
    <div
      v-show="isOpen"
      class="sidebar fixed z-[1000] bg-white shadow-lg p-2 flex flex-col justify-center items-center gap-4 rounded-md"
      :class="
        isMobile ? 'top-0 left-0 w-28 max-w-[90%] h-full p-1 gap-2' : 'top-1/2 left-8 w-14 p-2 gap-4 -translate-y-1/2'
      "
    >
      <div v-if="auth?.user?.role === 'admin'" class="flex flex-col gap-4">
        <button
          class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
          @click="$router.push('/admin')"
        >
          <Icon name="mdi:home" class="w-6 h-6" />
        </button>
        <LazyArticleCreate v-slot="{ open }" hydrateOnInteraction>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:pencil" class="w-6 h-6" />
          </button>
        </LazyArticleCreate>
        <LazyTagsCreate v-slot="{ open }" hydrateOnInteraction>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:tag-outline" class="w-6 h-6" />
          </button>
        </LazyTagsCreate>
        <LazyEmojiCreate v-slot="{ open }" hydrateOnInteraction>
          <button
            v-if="auth?.user?.plan !== 'BASIC'"
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:emoticon" class="w-6 h-6" />
          </button>
        </LazyEmojiCreate>
        <LazyStatsDialog v-slot="{ open }" hydrateOnInteraction>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:chart-bar" class="w-6 h-6" />
          </button>
        </LazyStatsDialog>
        <LazyClientPreferences v-slot="{ open }" hydrateOnInteraction>
          <button
            v-if="auth?.user?.plan !== 'BASIC'"
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:cog" class="w-6 h-6" />
          </button>
        </LazyClientPreferences>
      </div>
      <div v-if="auth?.user?.role === 'superadmin'" class="flex flex-col gap-4">
        <button
          class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
          @click="$router.push('/master')"
        >
          <Icon name="mdi:home" class="w-6 h-6" />
        </button>
        <LazyClientCreate v-slot="{ open }" hydrateOnInteraction>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:account-plus" class="w-6 h-6" />
          </button>
        </LazyClientCreate>
        <LazyUserList v-slot="{ open }" hydrateOnIdle>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 hover:bg-gray-100 hover:shadow-sm transition-all duration-150"
            @click="open.value = true"
          >
            <Icon name="mdi:account-group" class="w-6 h-6" />
          </button>
        </LazyUserList>
      </div>
      <AuthLogout />
    </div>
  </transition>
  <transition
    enterActiveClass="transition-opacity duration-300 ease-out"
    enterFromClass="opacity-0"
    enterToClass="opacity-100"
    leaveActiveClass="transition-opacity duration-300 ease-in"
    leaveFromClass="opacity-100"
    leaveToClass="opacity-0"
  >
    <div
      v-if="isMobile && isOpen"
      class="fixed inset-0 z-30 bg-black/40"
      :style="{ backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.5) !important' : undefined }"
      @click="isOpen = false"
    />
  </transition>
</template>

<script setup lang="ts">
import { useThemeStore } from '~~/stores/theme'

const isOpen = defineModel<boolean>('isOpen')

const { data: auth } = useAuth()

const theme = useThemeStore()

const isMobile = shallowRef<boolean>(false)

const updateIsMobile = () => (isMobile.value = window.innerWidth < 768)

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))
})

watch(isMobile, (mobile) => !mobile && (isOpen.value = true), { immediate: true })
</script>
