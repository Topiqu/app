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
        <Button icon="mdi:home" variant="neutral" @click="router.push('/admin')" />
        <LazyArticleModal v-slot="{ open }" hydrateOnInteraction>
          <Button icon="mdi:pencil" variant="neutral" @click="open.value = true" />
        </LazyArticleModal>
        <LazyTagsCreate v-slot="{ open }" hydrateOnInteraction>
          <Button icon="mdi:tag-outline" variant="neutral" @click="open.value = true" />
        </LazyTagsCreate>
        <LazyEmojiCreate v-slot="{ open }" hydrateOnInteraction>
          <Button
            v-if="auth?.user?.plan !== 'BASIC'"
            icon="mdi:emoticon"
            variant="neutral"
            @click="open.value = true"
          />
        </LazyEmojiCreate>
        <LazyStatsDialog v-slot="{ open }" hydrateOnInteraction>
          <Button icon="mdi:chart-bar" variant="neutral" @click="open.value = true" />
        </LazyStatsDialog>
        <LazyClientPreferences v-slot="{ open }" hydrateOnInteraction>
          <Button icon="mdi:cog" variant="neutral" @click="open.value = true" />
        </LazyClientPreferences>
      </div>
      <div v-if="auth?.user?.role === 'superadmin'" class="flex flex-col gap-4">
        <Button icon="mdi:home" variant="neutral" @click="router.push('/master')" />
        <LazyClientCreate v-slot="{ open }" hydrateOnInteraction>
          <Button icon="mdi:account-plus" variant="neutral" @click="open.value = true" />
        </LazyClientCreate>
        <LazyUserList v-slot="{ open }" hydrateOnIdle>
          <Button icon="mdi:account-group" variant="neutral" @click="open.value = true" />
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
const isOpen = defineModel<boolean>('isOpen')

const { data: auth } = useAuth()

const router = useRouter()

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
