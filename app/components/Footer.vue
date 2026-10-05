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
      </div>
    </UFooter>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()

// Free blogs are the referral channel; the landing's analytics attribute sign-ups by these UTM tags.
const poweredByUrl = `https://topiqu.com/?${new URLSearchParams({
  utm_source: 'topiqu_blog',
  utm_medium: 'referral',
  utm_campaign: 'powered_by',
  utm_content: clientSite?.domain ?? '',
})}`
</script>
