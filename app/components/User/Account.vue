<template>
  <div class="relative group">
    <button
      ref="btn"
      class="flex items-center gap-3 px-3 py-2 rounded-xl bg-transparent dark:bg-transparent border-none transition-all duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800"
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
      <div class="hidden min-[1565px]:flex flex-col min-w-0">
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
        ref="dropdown"
        class="absolute right-0 top-full mt-2 w-[95vw] max-w-[20rem] sm:max-w-[22rem] rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-50 p-4 sm:p-5 border border-gray-100 dark:border-neutral-800 bg-transparent dark:bg-transparent backdrop-blur-md"
        @click.stop="show = true"
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
          <Icon v-else name="mdi:account-circle-outline" class="w-16 h-16 text-gray-400 dark:text-gray-600" />
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-lg text-gray-900 dark:text-white truncate max-w-[180px]">
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
          class="mt-4 pt-3 text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-700"
        >
          <p v-if="userData?.role === 'admin' || userData?.role === 'superadmin'">
            Administrátor ve: <span class="font-medium">{{ clientData?.name || 'Není přiřazen' }}</span>
          </p>
          <p>Přidal(a) se: {{ formatDate(userData?.createdAt) }}</p>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <Icon name="mdi:thumb-up-outline" class="w-4 h-4 text-green-500" />
              <span class="font-medium">{{ userData?.likesCount || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <Icon name="mdi:thumb-down-outline" class="w-4 h-4 text-red-500" />
              <span class="font-medium">{{ userData?.dislikesCount || 0 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <Icon name="mdi:comment-outline" class="w-4 h-4 text-blue-500" />
              <span class="font-medium">{{ userData?.commentsCount || 0 }}</span>
            </div>
          </div>
          <NuxtLink
            to="/uzivatel"
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
const dropdown = useTemplateRef('dropdown')

const isBtnHovered = useElementHover(btn)
const isDropdownHovered = useElementHover(dropdown)
const isHovered = computed(() => isBtnHovered.value || isDropdownHovered.value)

const hideDropdown = useDebounceFn(() => {
  if (!isDropdownHovered.value) {
    show.value = false
  }
}, 500)

watch(isBtnHovered, (hovered, wasHovered) => {
  if (hovered && !show.value) {
    show.value = true
  } else if (!hovered && wasHovered && !show.value) {
    hideDropdown()
  }
})

onClickOutside(
  dropdown,
  () => {
    show.value = false
  },
  { ignore: [btn] },
)
</script>
