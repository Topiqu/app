<template>
  <div v-if="clientSite?.plan === 'BASIC'" class="mt-auto border-t border-default">
    <UFooter>
      <div class="flex items-center justify-center gap-4 text-base">
        <span class="font-medium text-muted">{{ $t('common.poweredBy') }}</span>
        <AppMedia
          src="/topik_normal_rm.png"
          alt=""
          aspectRatio="1 / 1"
          fit="contain"
          sizes="48px"
          containerClass="size-12 bg-transparent"
        />
        <strong class="text-lg text-primary">Topiqu</strong>
      </div>
    </UFooter>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
</script>
