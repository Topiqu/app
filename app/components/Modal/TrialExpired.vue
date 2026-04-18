<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>

    <div
      class="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-800"
    >
      <div class="p-8 text-center space-y-6">
        <div
          class="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center mb-2"
        >
          <Icon name="mdi:clock-alert-outline" size="40" class="text-amber-500 animate-pulse" />
        </div>

        <h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {{ $t('billing.trialEnded.title', 'Zkušební doba vypršela') }}
        </h2>

        <p class="text-slate-500 dark:text-slate-400 leading-relaxed text-sm md:text-base">
          {{
            $t(
              'billing.trialEnded.description',
              'Doufáme, že jste si testování Topiqu užili! Vaše 14denní zkušební lhůta právě skončila. Vaše data jsou v bezpečí, stačí si jen vybrat, jak chcete pokračovat.',
            )
          }}
        </p>

        <div class="pt-6 space-y-4">
          <Button
            variant="primary"
            size="lg"
            class="w-full shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300 flex justify-center items-center gap-2"
            icon="mdi:rocket-launch"
            @click="goToBilling"
          >
            {{ $t('billing.trialEnded.upgradeAction', 'Přejít na placený plán') }}
          </Button>

          <Button
            variant="neutral"
            size="lg"
            class="w-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex justify-center items-center"
            @click="continueFree"
          >
            {{ $t('billing.trialEnded.freeAction', 'Pokračovat s omezenou verzí zdarma') }}
          </Button>
        </div>

        <p class="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {{ $t('billing.trialEnded.note', 'Pokud máte dotazy nebo potřebujete čas navíc, napište nám na podporu.') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()

const emit = defineEmits(['continueFree'])

const goToBilling = () => {
  open.value = false
  navigateTo('/admin?tab=preferences')
}

const continueFree = () => {
  emit('continueFree')
  open.value = false
}
</script>

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
