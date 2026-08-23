<template>
  <UModal
    v-model:open="open"
    :title="$t('billing.trialEnded.title', 'Zkušební doba vypršela')"
    :description="
      $t(
        'billing.trialEnded.description',
        'Doufáme, že jste si testování Topiqu užili Vaše 14denní zkušební lhůta právě skončila. Vaše data jsou v bezpečí, stačí si jen vybrat, jak chcete pokračovat.',
      )
    "
    :dismissible="false"
  >
    <template #body>
      <UAlert
        color="warning"
        variant="soft"
        icon="i-mdi-clock-alert-outline"
        :title="$t('billing.trialEnded.note', 'Pokud máte dotazy nebo potřebujete čas navíc, napište nám na podporu.')"
      />
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="soft" size="lg" @click="continueFree">
          {{ $t('billing.trialEnded.freeAction', 'Pokračovat s omezenou verzí zdarma') }}
        </UButton>
        <UButton icon="i-mdi-rocket-launch" size="lg" @click="goToBilling">
          {{ $t('billing.trialEnded.upgradeAction', 'Přejít na placený plán') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ default: false })

const emit = defineEmits(['continueFree'])

const localePath = useLocalePath()
const goToBilling = () => {
  open.value = false
  navigateTo(localePath({ name: 'settings', query: { tab: 'billing' } }))
}

const continueFree = () => {
  emit('continueFree')
  open.value = false
}
</script>
