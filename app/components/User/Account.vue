<template>
  <div class="relative">
    <button
      ref="btn"
      class="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
      @click="show = !show"
    >
      <NuxtImg
        v-if="userData?.avatarUrl"
        :src="userData.avatarUrl"
        alt="Profilový obrázek"
        class="w-8 h-8 rounded-full object-cover"
        width="32"
        height="32"
      />
      <Icon v-else name="mdi:account-circle-outline" class="w-8 h-8 text-gray-400 dark:text-gray-600" />
    </button>
    <Transition
      enterActiveClass="transition ease-out duration-200"
      enterFromClass="opacity-0 scale-95"
      enterToClass="opacity-100 scale-100"
      leaveActiveClass="transition ease-in duration-150"
      leaveFromClass="opacity-100 scale-100"
      leaveToClass="opacity-0 scale-95"
    >
      <div
        v-if="show || isHovered"
        class="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-900 rounded-xl shadow-xl z-50 p-5"
      >
        <div class="flex items-center gap-4">
          <NuxtImg
            v-if="userData?.avatarUrl"
            :src="userData.avatarUrl"
            alt="Profilový obrázek"
            class="w-14 h-14 rounded-full object-cover"
            width="56"
            height="56"
          />
          <Icon v-else name="mdi:account-circle-outline" class="w-14 h-14 text-gray-400 dark:text-gray-600" />
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-900 dark:text-white text-lg truncate">
                {{ userData?.username }}
              </span>
              <span
                v-if="userData?.role === 'admin' || userData?.role === 'superadmin'"
                :class="[
                  'text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1',
                  clientData?.plan === 'PREMIUM'
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-md'
                    : clientData?.plan === 'PRO'
                      ? 'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white shadow-md'
                      : clientData?.plan === 'CUSTOM'
                        ? 'bg-gradient-to-r from-pink-400 to-pink-600 text-white shadow-md'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
                ]"
              >
                <Icon
                  v-if="['PREMIUM', 'PRO', 'CUSTOM'].includes(clientData?.plan || '')"
                  :name="
                    clientData?.plan === 'PREMIUM'
                      ? 'mdi:crown'
                      : clientData?.plan === 'PRO'
                        ? 'mdi:star'
                        : 'mdi:diamond'
                  "
                  class="w-4 h-4"
                />
                {{ userData.role === 'admin' ? 'Admin' : 'Superadmin' }}
              </span>
            </div>
            <p class="text-gray-500 dark:text-gray-400 text-sm truncate">{{ userData?.email }}</p>
          </div>
        </div>
        <div class="mt-3 text-sm text-gray-700 dark:text-gray-300">
          <p class="whitespace-pre-wrap break-words">{{ userData?.bio || 'Žádné bio' }}</p>
        </div>
        <div
          class="mt-3 pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1 border-t border-gray-200 dark:border-gray-700"
        >
          <p v-if="userData?.role === 'admin' || userData?.role === 'superadmin'">
            Administrátor ve: {{ clientData?.name || 'Není přiřazen' }}
          </p>
          <p>Přidal(a) se: {{ formatDate(userData?.createdAt) }}</p>
          <NuxtLink :to="`/uzivatel`" class="text-blue-600 dark:text-blue-400 hover:underline">
            Zobrazit profil
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
const { data: userData } = await useFetch(`/api/users/${useAuth().data.value?.user.id}`)
const { data: clientData } = await useFetch(`/api/clients/${useAuth().data.value?.user.id}/by-userid`)
const show = shallowRef(false)
const btn = useTemplateRef('btn')
const isHovered = useElementHover(btn)
onClickOutside(btn, () => (show.value = false))
</script>
