<template>
  <div class="relative group">
    <button
      ref="btn"
      class="flex items-center gap-3 px-3 py-2 bg-transparent dark:bg-transparent border-none rounded-xl hover:bg-transparent !important transition-all duration-200 cursor-pointer"
      style="background: transparent !important"
      @click="show = !show"
    >
      <NuxtImg
        v-if="userData?.avatarUrl"
        :src="userData.avatarUrl"
        alt="Profilový obrázek"
        class="w-9 h-9 rounded-full object-cover ring-2 ring-transparent hover:ring-blue-500 transition-all duration-200"
        width="36"
        height="36"
      />
      <Icon
        v-else
        name="mdi:account-circle-outline"
        class="w-9 h-9 text-gray-400 dark:text-gray-600 transition-colors duration-200"
      />
      <div class="flex flex-col min-w-0 bg-transparent dark:bg-transparent">
        <div class="flex items-center gap-2 bg-transparent">
          <span class="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
            {{ userData?.username }}
          </span>
          <span
            v-if="userData?.role === 'admin' || userData?.role === 'superadmin'"
            :class="[
              'text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm',
              clientData?.plan === 'PREMIUM'
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                : clientData?.plan === 'PRO'
                  ? 'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white'
                  : clientData?.plan === 'CUSTOM'
                    ? 'bg-gradient-to-r from-pink-400 to-pink-600 text-white'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            ]"
          >
            <Icon
              v-if="['PREMIUM', 'PRO', 'CUSTOM'].includes(clientData?.plan || '')"
              :name="
                clientData?.plan === 'PREMIUM' ? 'mdi:crown' : clientData?.plan === 'PRO' ? 'mdi:star' : 'mdi:diamond'
              "
              class="w-3.5 h-3.5"
            />
            {{ userData.role === 'admin' ? 'Admin' : 'Superadmin' }}
          </span>
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400 truncate">
          {{ userData?.email }}
        </span>
      </div>
    </button>
    <Transition
      enterActiveClass="transition ease-out duration-200"
      enterFromClass="opacity-0 translate-y-1 scale-95"
      enterToClass="opacity-100 translate-y-0 scale-100"
      leaveActiveClass="transition ease-in duration-150"
      leaveFromClass="opacity-100 translate-y-0 scale-100"
      leaveToClass="opacity-0 translate-y-1 scale-95"
    >
      <div
        v-if="show || isHovered"
        class="absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-50 p-5 border border-gray-100 dark:border-neutral-800 bg-transparent dark:bg-transparent backdrop-blur-md"
      >
        <div class="flex items-center gap-4 bg-transparent dark:bg-transparent">
          <NuxtImg
            v-if="userData?.avatarUrl"
            :src="userData.avatarUrl"
            alt="Profilový obrázek"
            class="w-16 h-16 rounded-full object-cover ring-2 ring-transparent hover:ring-blue-500 transition-all duration-200"
            width="64"
            height="64"
          />
          <Icon
            v-else
            name="mdi:account-circle-outline"
            class="w-16 h-16 text-gray-400 dark:text-gray-600 transition-colors duration-200"
          />
          <div class="flex flex-col min-w-0 bg-transparent">
            <div class="flex items-center gap-2 bg-transparent">
              <span class="font-semibold text-gray-900 dark:text-white text-lg truncate">
                {{ userData?.username }}
              </span>
              <span
                v-if="userData?.role === 'admin' || userData?.role === 'superadmin'"
                :class="[
                  'text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm',
                  clientData?.plan === 'PREMIUM'
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                    : clientData?.plan === 'PRO'
                      ? 'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white'
                      : clientData?.plan === 'CUSTOM'
                        ? 'bg-gradient-to-r from-pink-400 to-pink-600 text-white'
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
                  class="w-3.5 h-3.5"
                />
                {{ userData.role === 'admin' ? 'Admin' : 'Superadmin' }}
              </span>
              <AuthLogout class="ml-auto" />
            </div>
            <span class="text-sm text-gray-500 dark:text-gray-400 break-all">
              {{ userData?.email }}
            </span>
          </div>
        </div>
        <div class="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <p class="whitespace-pre-wrap break-words">{{ userData?.bio || 'Žádné bio' }}</p>
        </div>
        <div
          class="mt-4 pt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1 border-t border-gray-200 dark:border-gray-700"
        >
          <p v-if="userData?.role === 'admin' || userData?.role === 'superadmin'">
            Administrátor ve: <span class="font-medium">{{ clientData?.name || 'Není přiřazen' }}</span>
          </p>
          <p>Přidal(a) se: {{ formatDate(userData?.createdAt) }}</p>
          <NuxtLink
            :to="`/uzivatel`"
            class="inline-block text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors duration-200"
          >
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
