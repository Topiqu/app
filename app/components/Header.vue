<template>
  <UHeader :toggle="false" class="fixed inset-x-0 top-0 z-header h-16">
    <template #left>
      <UDashboardSidebarToggle v-if="showDashboard" class="md:hidden" :aria-label="$t('common.actions.openMenu')" />
      <UButton
        v-if="articleState.showHeader && articleHeader"
        :to="articleHeader.backTo"
        color="neutral"
        variant="ghost"
        square
        icon="i-mdi-arrow-left"
        :aria-label="$t('common.actions.back')"
      />
      <NuxtLink v-else :to="localePath({ name: 'index' })" class="flex items-center justify-center gap-2">
        <AppMedia
          :src="logoSrc"
          :originalSrc="isPublicationSurface ? '/app-logo.png' : undefined"
          :alt="isPublicationSurface ? clientSite?.name || 'Topiqu' : 'Topiqu'"
          :fallbackText="isPublicationSurface ? clientSite?.name : 'Topiqu'"
          aspectRatio="1 / 1"
          fit="contain"
          sizes="48px"
          priority
          containerClass="size-12 bg-transparent"
        />
      </NuxtLink>
    </template>
    <p
      v-if="articleState.showHeader && articleHeader"
      class="max-w-[45vw] truncate text-sm font-semibold text-highlighted sm:max-w-[55vw]"
    >
      {{ articleHeader.title }}
    </p>
    <template #right>
      <div class="flex items-center justify-between gap-2">
        <UButton
          v-if="articleState.showHeader && articleHeader"
          :color="articleHeader.liked ? 'error' : 'neutral'"
          :variant="articleHeader.liked ? 'soft' : 'ghost'"
          square
          :icon="articleHeader.liked ? 'i-mdi-heart' : 'i-mdi-heart-outline'"
          :aria-label="$t('common.actions.like')"
          @click="articleLikeBus.emit()"
        />
        <UButton
          v-if="articleState.showHeader && articleHeader?.canEdit"
          :to="localePath({ name: 'admin-editor-id', params: { id: articleHeader.articleId } })"
          color="neutral"
          variant="ghost"
          square
          icon="i-mdi-pencil"
          :aria-label="$t('common.actions.edit')"
        />
        <UserAccount />
        <ThemeToggle />
        <NotificationBar />
      </div>
    </template>
    <template #bottom>
      <UProgress
        v-if="isArticleRoute"
        class="absolute inset-x-0 bottom-0"
        :modelValue="articleState.progress"
        :max="100"
        size="xs"
        aria-label="Reading progress"
      />
    </template>
  </UHeader>
</template>

<script lang="ts" setup>
const _isSidebarOpen = defineModel<boolean>('isSidebarOpen')

const route = useRoute()
const clientSite = await useClientSite()
const { data: auth } = useAuth()
const localePath = useLocalePath()
const articleHeader = useArticleHeaderContext()
const articleState = useArticleScrollState()
const articleLikeBus = useArticleLikeBus()
const isArticleRoute = computed(() => String(route.name || '').includes('clanky-slug'))

const shell = computed(() => resolvePageShell(route.meta.shell))
const showDashboard = computed(() => canRenderDashboardShell(shell.value, auth.value?.user.role))
const isPublicationSurface = computed(() => {
  return Boolean(clientSite && shell.value === 'publication')
})
const logoSrc = computed(() => (isPublicationSurface.value ? clientSite?.logoUrl || '/app-logo.png' : '/app-logo.png'))
</script>
