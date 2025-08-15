<template>
  <Modal v-model="open" title="Vysvětlení preferencí">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
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
    </template>

    <template #footer="{ close }">
      <button
        class="px-5 py-2.5 rounded-xl text-sm font-medium transition hover:scale-105 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm"
        @click="close"
      >
        Zavřít
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()
</script>
