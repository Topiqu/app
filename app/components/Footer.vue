<template>
  <div v-if="clientSite" class="mt-auto border-t border-default">
    <UFooter>
      <div class="flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
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
        <span v-else class="text-sm font-semibold text-highlighted">{{ clientSite.name }}</span>
        <div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <NuxtLink
            :to="localePath({ name: 'privacy' })"
            class="text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
          >
            {{ $t('common.consent.moreInfo') }}
          </NuxtLink>
          <ULink as="button" type="button" @click="settingsOpen = true">
            {{ $t('common.consent.openSettings') }}
          </ULink>
        </div>
      </div>
    </UFooter>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
const localePath = useLocalePath()
const settingsOpen = useConsentSettingsOpen()

// Free blogs are the referral channel; the landing's analytics attribute sign-ups by these UTM tags.
const poweredByUrl = `https://topiqu.com/?${new URLSearchParams({
  utm_source: 'topiqu_blog',
  utm_medium: 'referral',
  utm_campaign: 'powered_by',
  utm_content: clientSite?.domain ?? '',
})}`
</script>
