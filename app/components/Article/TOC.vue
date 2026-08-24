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
          icon="i-mdi-format-list-bulleted"
          class="fixed right-4 top-24 z-sidebar lg:hidden"
          :aria-label="String($t('articles.tableOfContents.title'))"
        />
        <template #body>
          <nav :aria-label="String($t('articles.tableOfContents.title'))">
            <ul class="space-y-1">
              <li v-for="heading in state.headings" :key="heading.id" class="py-2">
                <NuxtLink
                  :to="`#${heading.id}`"
                  class="block border-l-2 pr-2 text-sm"
                  :class="[
                    heading.level === 2 ? 'pl-5' : heading.level === 3 ? 'pl-8' : 'pl-3',
                    state.activeId === heading.id
                      ? 'border-primary font-semibold text-primary'
                      : 'border-transparent text-muted',
                  ]"
                  :aria-current="state.activeId === heading.id ? 'location' : undefined"
                  @click="isMobileOpen = false"
                >
                  {{ heading.text }}
                </NuxtLink>
              </li>
            </ul>
          </nav>
        </template>
      </UDrawer>
    </ClientOnly>

    <aside
      v-if="state.headings.length || $slots.sidebar"
      class="sticky top-[calc(var(--topiqu-header-height)+1.5rem)] hidden max-h-[calc(100dvh-var(--topiqu-header-height)-3rem)] min-w-0 self-start overflow-y-auto overscroll-contain lg:block"
      :aria-label="String($t(state.headings.length ? 'articles.tableOfContents.title' : 'common.advertisement'))"
    >
      <div v-if="state.headings.length">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
          <UIcon name="i-mdi-format-align-left" size="16" />
          {{ $t('articles.tableOfContents.title') }}
        </h2>
        <nav class="mt-3" :aria-label="String($t('articles.tableOfContents.title'))">
          <ul class="border-l border-default py-1">
            <li v-for="heading in state.headings" :key="heading.id" class="py-1.5">
              <NuxtLink
                :to="`#${heading.id}`"
                class="-ml-px block border-l pr-2 text-[0.8125rem] leading-5"
                :class="[
                  heading.level === 2 ? 'pl-5' : heading.level === 3 ? 'pl-8' : 'pl-3',
                  state.activeId === heading.id
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-muted hover:text-highlighted',
                ]"
                :aria-current="state.activeId === heading.id ? 'location' : undefined"
              >
                {{ heading.text }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
      <div v-if="$slots.sidebar" :class="state.headings.length ? 'mt-8 border-t border-default pt-6' : ''">
        <slot name="sidebar" />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
const state = useArticleScrollState()
const isMobileOpen = shallowRef(false)
</script>
