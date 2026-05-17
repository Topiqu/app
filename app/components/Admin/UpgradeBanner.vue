<template>
  <div
    v-if="clientSite?.plan === 'BASIC'"
    class="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 justify-between"
  >
    <div class="flex items-center gap-3">
      <Icon name="mdi:rocket-launch" class="w-6 h-6 text-purple-500 shrink-0" />
      <div>
        <h4 class="font-bold text-purple-800 dark:text-purple-300 text-sm">
          {{ $t('admin.upgrade.title') }}
        </h4>
        <p class="text-sm text-purple-700 dark:text-purple-200/80">
          {{ $t('admin.upgrade.description') }}
        </p>
      </div>
    </div>

    <Button
      variant="primary"
      class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white whitespace-nowrap shadow-md"
      @click="upgrade"
    >
      <Icon name="mdi:star-four-points" class="w-4 h-4 mr-2" />
      {{ $t('common.tokens.upgradeToPremium') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()

const upgrade = () => navigateTo('/pricing?plan=PREMIUM')
</script>
