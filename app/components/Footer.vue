<template>
  <div v-if="clientSite" class="mt-auto border-t border-default">
    <UFooter>
      <div class="flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
        <div v-if="clientSite.plan === 'BASIC'" class="flex items-center justify-center gap-3 text-base">
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
        </div>
        <span v-else class="text-sm font-semibold text-highlighted">{{ clientSite.name }}</span>
      </div>
    </UFooter>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
</script>
