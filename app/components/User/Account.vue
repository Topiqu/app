<template>
  <div class="relative group">
    <div v-if="auth">
      <button
        ref="btn"
        class="flex items-center gap-3 rounded-xl bg-transparent dark:bg-transparent border-none transition-all duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800"
        style="background: transparent !important"
        @click="show = !show"
      >
        <UserPicture :url="userData?.avatarUrl" :name="userData?.username" />
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
              {{ userData.role === 'admin' ? $t('articles.userMenu.admin') : $t('articles.userMenu.superadmin') }}
            </span>
          </div>
          <span class="text-left text-xs text-gray-500 dark:text-gray-400 truncate">
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
          v-if="show || hoverShow"
          ref="dropdown"
          class="absolute right-0 top-full mt-2 w-[95vw] max-w-[20rem] sm:max-w-[22rem] rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-50 p-4 sm:p-5 border border-gray-100 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm"
          @click.stop
        >
          <div class="flex items-center gap-4 bg-transparent dark:bg-transparent">
            <UserPicture :url="userData?.avatarUrl" :size="'lg'" :name="userData?.username" />
            <div class="grow flex flex-col min-w-0">
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
                  {{ userData.role === 'admin' ? $t('articles.userMenu.admin') : $t('articles.userMenu.superadmin') }}
                </span>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400 break-all">
                {{ userData?.email }}
              </span>
            </div>
            <AuthLogout v-if="auth" />
          </div>
          <div class="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <p class="whitespace-pre-wrap break-words">{{ userData?.bio || $t('articles.userMenu.noBio') }}</p>
          </div>
          <div
            class="mt-4 pt-3 text-xs text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-700"
          >
            <p v-if="userData?.role === 'admin'">
              {{ $t('articles.userMenu.adminIn', [clientData?.name || $t('articles.userMenu.noClientAssigned')]) }}
            </p>
            <p>{{ $t('common.user.joined', [formatDate(userData?.createdAt)]) }}</p>
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
              {{ $t('common.user.viewProfile') }}
            </NuxtLink>
          </div>
        </div>
      </Transition>
    </div>
    <div v-else>
      <button
        ref="btn"
        class="flex items-center gap-2 px-3 py-2 rounded-xl bg-transparent dark:bg-transparent border-none transition-all duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800"
        style="background: transparent !important"
        @click="show = !show"
      >
        <Icon
          name="mdi:account-circle-outline"
          class="w-9 h-9 text-gray-400 dark:text-gray-600 transition-colors duration-200"
        />
        <span class="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
          {{ $t('articles.userMenu.login') }}
        </span>
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
          v-if="show || hoverShow"
          ref="dropdown"
          class="absolute right-0 top-full mt-2 w-[95vw] max-w-[20rem] sm:max-w-[22rem] rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-50 p-4 sm:p-5 border border-gray-100 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm"
          @click.stop
        >
          <div class="flex flex-col gap-4">
            <NuxtImg
              src="/app-logo.png"
              :alt="$t('articles.userMenu.companyLogoAlt')"
              class="w-24 h-24 mx-auto object-contain"
              width="96"
              height="96"
            />
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-4">
                <Icon name="mdi:account-circle-outline" class="w-16 h-16 text-gray-400 dark:text-gray-600" />
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('articles.userMenu.loginPrompt') }}
                </p>
              </div>
              <div class="flex flex-col gap-2">
                <NuxtLink
                  to="/autorizace"
                  class="block w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold text-center transition"
                >
                  {{ $t('articles.userMenu.login') }}
                </NuxtLink>
                <NuxtLink
                  to="/autorizace?mode=register"
                  class="block w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-center text-sm font-semibold transition"
                >
                  {{ $t('articles.userMenu.register') }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { UserRole } from '@prisma/client'

import { formatDate } from '~~/shared/utils'

interface User {
  id: string
  username: string
  email: string
  avatarUrl?: string
  role: UserRole
  bio?: string
  createdAt: string
  likesCount: number
  dislikesCount: number
  commentsCount: number
}

interface Client {
  name: string
  plan?: 'PREMIUM' | 'PRO' | 'CUSTOM' | string
}

const { data: auth } = useAuth()
const toast = useToast()

const userData = ref<User | null>(null)
const clientData = ref<Client | null>(null)

const show = shallowRef<boolean>(false)
const hoverShow = shallowRef<boolean>(false)

const btn = useTemplateRef('btn')
const dropdown = useTemplateRef('dropdown')

const isBtnHovered = useElementHover(btn)
const isDropdownHovered = useElementHover(dropdown)
const isHovered = computed(() => isBtnHovered.value || isDropdownHovered.value)

watch(show, (newValue) => {
  if (newValue) hoverShow.value = true
  else hoverShow.value = false
})

watch(isHovered, (hovered) => {
  if (hovered) hoverShow.value = true
  else setTimeout(() => !isHovered.value && (hoverShow.value = false), 50)
})

watch(
  auth,
  async (newAuth) => {
    if (newAuth?.user?.id) {
      try {
        const [userResponse, clientResponse] = await Promise.all([
          $fetch<User>(`/api/users/${newAuth.user.id}`),
          $fetch<Client>(`/api/clients/${newAuth.user.id}/by-userid`),
        ])
        userData.value = userResponse
        clientData.value = clientResponse
      } catch (e: unknown) {
        const error = e as { data?: { message?: string } }
        toast.error({ message: error.data?.message || $t('articles.userMenu.userDataError') })
      }
    } else {
      userData.value = null
      clientData.value = null
    }
  },
  { immediate: true },
)

onClickOutside(dropdown, () => (show.value = false), { ignore: [btn] })
</script>
