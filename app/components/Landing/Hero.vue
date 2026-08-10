<template>
  <div class="w-full border-b border-default bg-default">
    <nav class="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-8">
      <NuxtLink :to="localePath({ name: 'index' })" class="flex items-center gap-2">
        <AppMedia
          src="/topik_normal_rm.png"
          alt="Topiqu"
          aspectRatio="1 / 1"
          fit="contain"
          sizes="40px"
          priority
          containerClass="size-10 bg-transparent"
        />
        <span class="text-lg font-bold tracking-tight text-highlighted">Topiqu</span>
      </NuxtLink>

      <div class="hidden items-center gap-1 md:flex">
        <UButton color="neutral" variant="ghost" @click="$emit('scroll', 'specs')">
          {{ $t('common.actions.learn_more') }}
        </UButton>
        <UButton color="neutral" variant="ghost" @click="$emit('scroll', 'pricing')">
          {{ $t('landing.pricing.title') }}
        </UButton>
        <UButton color="neutral" variant="ghost" @click="$emit('scroll', 'faq')">
          {{ $t('landing.faq.title') }}
        </UButton>
        <UButton :to="localePath({ name: 'autorizace' })" color="primary">
          {{ $t('common.auth.login') }}
        </UButton>
      </div>

      <UDropdownMenu :items="mobileNavigation" class="md:hidden">
        <UButton color="neutral" variant="ghost" icon="i-mdi-menu" square :aria-label="$t('common.actions.openMenu')" />
      </UDropdownMenu>
    </nav>

    <header
      class="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[90rem] items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)] lg:px-8 lg:py-16"
    >
      <div class="max-w-3xl">
        <UBadge color="primary" variant="soft" icon="i-mdi-newspaper-variant-outline">
          {{ $t('landing.hero.badge') }}
        </UBadge>
        <h1
          class="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-highlighted sm:text-5xl lg:text-6xl"
        >
          {{ $t('landing.hero.title_prefix') }}
          <span class="text-primary">{{ $t('landing.hero.title_suffix') }}</span>
        </h1>
        <p class="mt-6 max-w-[62ch] text-pretty text-lg leading-8 text-muted">
          {{ $t('landing.hero.subtitle') }}
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <UButton
            :to="{ query: { ...$route.query, onboarding: '1' } }"
            color="primary"
            size="lg"
            trailingIcon="i-mdi-arrow-right"
          >
            {{ $t('common.actions.get_started') }}
          </UButton>
          <UButton color="neutral" variant="outline" size="lg" @click="$emit('scroll', 'specs')">
            {{ $t('common.actions.learn_more') }}
          </UButton>
        </div>
      </div>

      <div class="relative mx-auto w-full max-w-xl" aria-hidden="true">
        <div
          class="overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default bg-elevated p-2 shadow-xl shadow-primary/10"
        >
          <div class="aspect-[16/10] overflow-hidden rounded-lg border border-default bg-default">
            <div class="flex h-8 items-center gap-1.5 border-b border-default px-3">
              <span v-for="dot in 3" :key="dot" class="size-2 rounded-full bg-accented" />
            </div>
            <div class="grid h-[calc(100%-2rem)] grid-cols-[4.5rem_1fr]">
              <div class="space-y-3 border-r border-default bg-elevated p-3">
                <span class="block h-2 w-full rounded bg-accented" />
                <span class="block h-2 w-3/4 rounded bg-accented" />
                <span class="block h-2 w-5/6 rounded bg-accented" />
              </div>
              <div class="space-y-4 p-5">
                <div class="h-5 w-2/5 rounded bg-primary/25" />
                <div class="grid grid-cols-3 gap-3">
                  <div v-for="card in 3" :key="card" class="h-16 rounded-lg border border-default bg-elevated" />
                </div>
                <div class="space-y-3 rounded-lg border border-default p-4">
                  <span
                    v-for="line in 4"
                    :key="line"
                    class="block h-2 rounded bg-accented"
                    :class="line === 4 ? 'w-2/3' : 'w-full'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <AppMedia
          src="/topik_normal_rm.png"
          alt=""
          aspectRatio="1 / 1"
          fit="contain"
          sizes="180px"
          priority
          containerClass="absolute -bottom-8 -right-2 size-32 bg-transparent sm:-right-8 sm:size-44"
        />
      </div>
    </header>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const emit = defineEmits<{
  (e: 'scroll', id: string): void
}>()

const mobileNavigation = computed(() => [
  [
    {
      label: $t('common.actions.learn_more'),
      icon: 'i-mdi-book-open-page-variant-outline',
      onSelect: () => emit('scroll', 'specs'),
    },
    {
      label: $t('landing.pricing.title'),
      icon: 'i-mdi-tag-outline',
      onSelect: () => emit('scroll', 'pricing'),
    },
    {
      label: $t('landing.faq.title'),
      icon: 'i-mdi-help-circle-outline',
      onSelect: () => emit('scroll', 'faq'),
    },
  ],
  [
    {
      label: $t('common.auth.login'),
      icon: 'i-mdi-login',
      to: localePath({ name: 'autorizace' }),
    },
  ],
])
</script>
