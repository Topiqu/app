<template>
  <div v-if="clientSite && settings.enabled" class="mt-auto border-t border-default bg-default" data-publication-footer>
    <UFooter :ui="{ left: textOnly ? 'justify-center lg:justify-center' : undefined }">
      <template #left>
        <NuxtLink
          v-if="clientSite.plan === 'BASIC'"
          :to="poweredByUrl"
          external
          target="_blank"
          rel="noopener"
          class="flex items-center justify-center gap-3 text-base"
        >
          <span class="font-medium text-muted">{{ $t('common.poweredBy') }}</span>
          <AppMedia
            src="/topik_normal_rm.png"
            alt=""
            aspectRatio="1 / 1"
            fit="contain"
            sizes="40px"
            containerClass="size-10 bg-transparent"
          />
          <strong class="text-lg text-primary">Topiqu</strong>
        </NuxtLink>
        <p
          v-else
          class="min-w-0 max-w-2xl whitespace-pre-line break-words text-sm text-highlighted"
          :class="{ 'text-center': textOnly }"
        >
          {{ settings.text || clientSite.name }}
        </p>
      </template>
      <nav
        v-if="settings.links.length"
        :aria-label="$t('common.preferences.footer.links')"
        class="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-sm"
      >
        <NuxtLink
          v-for="(link, index) in settings.links"
          :key="index"
          :to="link.url"
          class="break-words text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
          >{{ link.label }}</NuxtLink
        >
      </nav>
      <template #right>
        <ClientSocials v-if="socials.length" :socials />
      </template>
    </UFooter>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useLiveClientSite()
const settings = computed(() => resolveFooterSettings(clientSite.value?.footerSettings, clientSite.value?.plan))
const socials = computed(() =>
  settings.value.showSocials || clientSite.value?.plan === 'BASIC' ? (clientSite.value?.socials ?? []) : [],
)
const textOnly = computed(() => !settings.value.links.length && !socials.value.length)

// Free blogs are the referral channel; the landing's analytics attribute sign-ups by these UTM tags.
const poweredByUrl = computed(
  () =>
    `https://topiqu.com/?${new URLSearchParams({
      utm_source: 'topiqu_blog',
      utm_medium: 'referral',
      utm_campaign: 'powered_by',
      utm_content: clientSite.value?.domain ?? '',
    })}`,
)
</script>
