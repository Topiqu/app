<template>
  <div class="contents">
    <ClientOnly v-if="state.headings.length">
      <UDrawer
        v-model:open="isMobileOpen"
        direction="right"
        :title="String($t('articles.tableOfContents.title'))"
        class="lg:hidden"
      >
        <UButton
          square
          size="lg"
          color="neutral"
          variant="soft"
          icon="mdi:format-list-bulleted"
          class="fixed right-4 top-24 z-sidebar lg:hidden"
          :aria-label="String($t('articles.tableOfContents.title'))"
        />
        <template #body>
          <nav :aria-label="String($t('articles.tableOfContents.title'))">
            <ul class="space-y-1">
              <li v-for="heading in state.headings" :key="heading.id" class="py-2">
                <a
                  :href="`#${heading.id}`"
                  class="block border-l-2 pr-2 text-sm font-semibold"
                  :class="[
                    heading.level === 2 ? 'pl-5' : heading.level === 3 ? 'pl-8' : 'pl-3',
                    state.activeId === heading.id ? 'border-primary text-primary' : 'border-transparent text-muted',
                  ]"
                  :aria-current="state.activeId === heading.id ? 'location' : undefined"
                  @click.prevent="goToMobileHeading(heading.id)"
                >
                  {{ heading.text }}
                </a>
              </li>
            </ul>
          </nav>
        </template>
      </UDrawer>
    </ClientOnly>

    <aside
      v-if="state.headings.length || $slots.sidebar"
      class="sticky hidden min-w-0 self-start overflow-y-auto overscroll-contain lg:block"
      :class="
        hasDashboardChrome
          ? 'top-6 max-h-[calc(100dvh-3rem)]'
          : 'top-[calc(var(--topiqu-header-height)+1.5rem)] max-h-[calc(100dvh-var(--topiqu-header-height)-3rem)]'
      "
      :aria-label="String($t(state.headings.length ? 'articles.tableOfContents.title' : 'common.advertisement'))"
    >
      <div v-if="state.headings.length">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
          <UIcon name="mdi:format-align-left" size="16" />
          {{ $t('articles.tableOfContents.title') }}
        </h2>
        <nav class="mt-3" :aria-label="String($t('articles.tableOfContents.title'))">
          <ul class="border-l border-default py-1">
            <li v-for="heading in state.headings" :key="heading.id" class="py-1.5">
              <a
                :href="`#${heading.id}`"
                class="-ml-px block border-l pr-2 text-[0.8125rem] font-semibold leading-5"
                :class="[
                  heading.level === 2 ? 'pl-5' : heading.level === 3 ? 'pl-8' : 'pl-3',
                  state.activeId === heading.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-highlighted',
                ]"
                :aria-current="state.activeId === heading.id ? 'location' : undefined"
                @click.prevent="goToHeading(heading.id)"
              >
                {{ heading.text }}
              </a>
            </li>
          </ul>
        </nav>
        <div class="mt-4 py-3">
          <div class="flex items-center justify-around gap-2">
            <UTooltip :text="$t('common.actions.share')">
              <UButton
                color="neutral"
                variant="ghost"
                square
                size="lg"
                icon="mdi:share-variant-outline"
                :aria-label="$t('common.actions.share')"
                @click="sharePage"
              />
            </UTooltip>
            <UTooltip :text="$t('common.actions.copyLink')">
              <UButton
                color="neutral"
                variant="ghost"
                square
                size="lg"
                icon="mdi:link-variant"
                :aria-label="$t('common.actions.copyLink')"
                @click="copyPageLink"
              />
            </UTooltip>
            <UTooltip text="X / Twitter">
              <UButton
                color="neutral"
                variant="ghost"
                square
                size="lg"
                icon="mdi:twitter"
                aria-label="X / Twitter"
                @click="shareTo('twitter')"
              />
            </UTooltip>
            <UTooltip text="LinkedIn">
              <UButton
                color="neutral"
                variant="ghost"
                square
                size="lg"
                icon="mdi:linkedin"
                aria-label="LinkedIn"
                @click="shareTo('linkedin')"
              />
            </UTooltip>
          </div>
        </div>
      </div>
      <div v-if="$slots.sidebar" :class="state.headings.length ? 'mt-3' : ''">
        <slot name="sidebar" />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
const state = useArticleScrollState()
const { data: auth } = useAuth()
const hasDashboardChrome = computed(() => ['admin', 'superadmin'].includes(auth.value?.user?.role || ''))
const isMobileOpen = shallowRef(false)
const reducedMotion = usePreferredReducedMotion()
const toast = useToast()
const goToHeading = (id: string) => {
  const heading = document.getElementById(id)
  if (!heading) return
  heading.scrollIntoView({ behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(history.state, '', `#${encodeURIComponent(id)}`)
}
const goToMobileHeading = (id: string) => {
  goToHeading(id)
  isMobileOpen.value = false
}
const pageUrl = () => window.location.href
const copyPageLink = async () => {
  await navigator.clipboard.writeText(pageUrl())
}
const sharePage = async () => {
  try {
    if (navigator.share) await navigator.share({ title: document.title, url: pageUrl() })
    else await copyPageLink()
  } catch (error) {
    if ((error as DOMException)?.name !== 'AbortError') {
      toast.add({ color: 'error', title: $t('common.messages.operationFailed') })
    }
  }
}
const shareTo = (network: 'twitter' | 'linkedin') => {
  const url = encodeURIComponent(pageUrl())
  const title = encodeURIComponent(document.title)
  const target =
    network === 'twitter'
      ? `https://twitter.com/intent/tweet?url=${url}&text=${title}`
      : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
  window.open(target, '_blank', 'noopener,noreferrer,width=720,height=640')
}
</script>
