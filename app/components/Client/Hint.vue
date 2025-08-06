<template>
  <Dialog as="div" class="relative z-[1010]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
    </TransitionChild>
    <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-150"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <DialogPanel
          class="w-full max-w-2xl p-8 sm:p-10 rounded-3xl shadow-xl border flex flex-col max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
        >
          <DialogTitle class="text-2xl font-bold leading-tight tracking-tight flex items-center gap-3">
            <Icon name="mdi:information-outline" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Vysvětlení preferencí
          </DialogTitle>
          <div class="flex flex-col divide-y divide-gray-200 dark:divide-gray-700 mt-6">
            <section class="py-6">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="mdi:bullseye" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Fokus</h3>
              </div>
              <p class="text-base leading-relaxed text-gray-700 dark:text-gray-200">
                Hlavní téma nebo směr obsahu. Pomáhá upřesnit tonalitu a vyznění výstupů podle vašeho záměru.
              </p>
              <p class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                Např. „Objektivní žurnalistika v gamingu“, „Technologické novinky s důrazem na Unreal Engine“.
              </p>
            </section>
            <section class="py-6">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="mdi:account-group-outline" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Cílová skupina
                </h3>
              </div>
              <p class="text-base leading-relaxed text-gray-700 dark:text-gray-200">
                Definuje, komu je obsah určen. Pomáhá ladit styl, jazyk i úroveň technické náročnosti.
              </p>
              <p class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                Např. „Mladí dospělí 18–25 let“, „Vývojáři her a IT profesionálové“.
              </p>
            </section>
            <section class="py-6">
              <div class="flex items-center gap-2 mb-2">
                <Icon name="mdi:tag-multiple-outline" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Klíčová slova
                </h3>
              </div>
              <p class="text-base leading-relaxed text-gray-700 dark:text-gray-200">
                Výrazná témata nebo pojmy, které se mají ve výstupech objevovat častěji. Slouží i pro SEO.
              </p>
              <p class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                Např. „Unreal Engine, AI ve hrách, RPG, hráčská svoboda“.
              </p>
            </section>
          </div>
          <div class="flex justify-end mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              class="px-5 py-2.5 rounded-xl text-sm font-medium transition hover:scale-105 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm"
              @click="$emit('close')"
            >
              Zavřít
            </button>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/vue'

defineEmits(['close'])
</script>
