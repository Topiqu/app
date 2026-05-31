<template>
  <div class="relative group z-50">
    <div v-if="auth">
      <button
        ref="btn"
        class="group/btn relative flex items-center gap-3 rounded-full p-1.5 pr-4 transition-all duration-300 ease-out hover:bg-white/60 dark:hover:bg-neutral-800/60 border border-transparent hover:border-gray-200/50 dark:hover:border-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        @click="show = !show"
      >
        <div class="relative" style="background: transparent !important">
          <UserPicture
            :url="userData?.avatarUrl"
            :name="userData?.username"
            class="ring-2 ring-white dark:ring-neutral-900 shadow-sm transition-transform duration-300 group-hover/btn:scale-105"
          />
          <div
            v-if="['PREMIUM', 'PRO', 'CUSTOM'].includes(clientData?.plan || '')"
            class="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-neutral-900 rounded-full p-[2px] shadow-sm"
          >
            <Icon name="mdi:circle-slice-8" class="w-3.5 h-3.5 text-emerald-500" />
          </div>
        </div>

        <div
          class="hidden min-[1565px]:flex flex-col items-start min-w-0 text-left gap-0.5"
          style="background: transparent !important"
        >
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate tracking-tight leading-none">
              {{ userData?.username }}
            </span>
            <span
              v-if="userData?.role === 'admin' || userData?.role === 'superadmin'"
              :class="[
                'text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-white/10',
                clientData?.plan === 'PREMIUM'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-orange-500/20'
                  : clientData?.plan === 'PRO'
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-indigo-500/20'
                    : clientData?.plan === 'CUSTOM'
                      ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-rose-500/20'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
              ]"
            >
              <Icon
                v-if="['PREMIUM', 'PRO', 'CUSTOM'].includes(clientData?.plan || '')"
                :name="
                  clientData?.plan === 'PREMIUM' ? 'mdi:crown' : clientData?.plan === 'PRO' ? 'mdi:star' : 'mdi:diamond'
                "
                class="w-3 h-3"
              />
              {{ userData.role === 'admin' ? 'Admin' : 'Super' }}
            </span>
          </div>
          <span
            class="text-xs text-gray-500 dark:text-gray-400 truncate font-medium leading-none opacity-80 group-hover/btn:opacity-100 transition-opacity"
          >
            {{ userData?.email }}
          </span>
        </div>

        <Icon
          name="mdi:chevron-down"
          class="w-4 h-4 text-gray-400 transition-transform duration-300 group-hover/btn:rotate-180"
          :class="{ 'rotate-180': show }"
        />
      </button>

      <Transition
        enterActiveClass="transition ease-out duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
        enterFromClass="opacity-0 translate-y-3 scale-95"
        enterToClass="opacity-100 translate-y-0 scale-100"
        leaveActiveClass="transition ease-in duration-150"
        leaveFromClass="opacity-100 translate-y-0 scale-100"
        leaveToClass="opacity-0 translate-y-2 scale-95"
      >
        <div
          v-if="show || hoverShow"
          ref="dropdown"
          class="fixed left-1/2 top-[80px] -translate-x-1/2 w-[92vw] max-w-[24rem] sm:absolute sm:top-full sm:mt-3 sm:left-auto sm:right-0 sm:translate-x-0 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] ring-1 ring-gray-900/5 dark:ring-white/10 dark:shadow-black/50 overflow-hidden bg-white/90 dark:bg-[#121212]/90 backdrop-blur-2xl border border-white/20 dark:border-white/5"
        >
          <div class="p-6 pb-4">
            <div class="flex items-start gap-4">
              <UserPicture
                :url="userData?.avatarUrl"
                :size="'lg'"
                :name="userData?.username"
                class="ring-4 ring-gray-50 dark:ring-white/5 rounded-full shadow-md"
              />
              <div class="flex-1 min-w-0 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-lg text-gray-900 dark:text-white truncate">
                    {{ userData?.username }}
                  </span>
                  <AuthLogout v-if="auth" class="opacity-70 hover:opacity-100 transition-opacity" />
                </div>
                <div class="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                  {{ userData?.email }}
                </div>
                <div class="pt-1">
                  <span
                    v-if="userData?.role === 'admin' || userData?.role === 'superadmin'"
                    :class="[
                      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                      clientData?.plan === 'PREMIUM'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                    ]"
                  >
                    {{ userData.role === 'admin' ? 'Administrator' : 'Superadmin' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="mt-5 p-4 rounded-2xl bg-gray-50/80 dark:bg-white/5 border border-gray-100 dark:border-white/5">
              <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                {{ userData?.bio || $t('articles.userMenu.noBio') }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-px bg-gray-100 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
            <div
              class="group flex flex-col items-center justify-center p-3 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-default"
            >
              <div class="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
                <Icon name="mdi:thumb-up" class="w-4 h-4" />
                <span class="font-bold text-sm">{{ userData?.likesCount || 0 }}</span>
              </div>
              <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{{
                $t('common.user.likes')
              }}</span>
            </div>
            <div
              class="group flex flex-col items-center justify-center p-3 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-default"
            >
              <div class="flex items-center gap-1.5 text-red-500 dark:text-red-400 mb-1">
                <Icon name="mdi:thumb-down" class="w-4 h-4" />
                <span class="font-bold text-sm">{{ userData?.dislikesCount || 0 }}</span>
              </div>
              <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{{
                $t('common.user.dislikes')
              }}</span>
            </div>
            <div
              class="group flex flex-col items-center justify-center p-3 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-default"
            >
              <div class="flex items-center gap-1.5 text-blue-500 dark:text-blue-400 mb-1">
                <Icon name="mdi:comment" class="w-4 h-4" />
                <span class="font-bold text-sm">{{ userData?.commentsCount || 0 }}</span>
              </div>
              <span class="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{{
                $t('common.user.comments')
              }}</span>
            </div>
          </div>

          <div class="p-4 bg-gray-50 dark:bg-[#0a0a0a]/50 border-t border-gray-100 dark:border-white/5 space-y-3">
            <div class="flex items-center justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500">
              <span>{{ $t('common.user.joined', [formatDate(userData?.createdAt)]) }}</span>
              <span v-if="userData?.role === 'admin'" class="opacity-75">
                {{ clientData?.name }}
              </span>
            </div>
            <NuxtLink
              :to="localePath({ name: 'uzivatel' })"
              class="flex items-center justify-center w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-200"
            >
              {{ $t('common.user.viewProfile') }}
              <Icon name="mdi:arrow-right" class="w-4 h-4 ml-1.5 opacity-80" />
            </NuxtLink>
          </div>
        </div>
      </Transition>
    </div>

    <div v-else>
      <button
        ref="btn"
        class="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all duration-300 border border-transparent hover:border-gray-200 dark:hover:border-white/10"
        @click="show = !show"
      >
        <div
          class="p-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full group-hover:bg-white dark:group-hover:bg-neutral-700 transition-colors shadow-sm"
        >
          <Icon name="mdi:account-circle" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <span
          class="font-semibold text-sm text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white"
        >
          {{ $t('common.auth.login') }}
        </span>
      </button>

      <Transition
        enterActiveClass="transition ease-out duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
        enterFromClass="opacity-0 translate-y-3 scale-95"
        enterToClass="opacity-100 translate-y-0 scale-100"
        leaveActiveClass="transition ease-in duration-150"
        leaveFromClass="opacity-100 translate-y-0 scale-100"
        leaveToClass="opacity-0 translate-y-2 scale-95"
      >
        <div
          v-if="show || hoverShow"
          ref="dropdown"
          class="absolute right-0 top-full mt-3 w-[90vw] max-w-[22rem] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] ring-1 ring-gray-900/5 dark:ring-white/10 dark:shadow-black/50 p-6 bg-white/90 dark:bg-[#121212]/95 backdrop-blur-2xl border border-white/20 dark:border-white/5"
          @click.stop
        >
          <div class="flex flex-col items-center gap-6 text-center">
            <div
              class="relative w-20 h-20 flex items-center justify-center bg-gradient-to-tr from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl shadow-inner mb-2"
            >
              <NuxtImg
                src="/app-logo.png"
                :alt="$t('articles.userMenu.companyLogoAlt')"
                class="w-14 h-14 object-contain drop-shadow-md"
              />
            </div>

            <div class="space-y-1">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">Welcome Back</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] mx-auto leading-relaxed">
                {{ $t('common.auth.loginPrompt') }}
              </p>
            </div>

            <div class="w-full space-y-3">
              <NuxtLink
                :to="localePath({ name: 'autorizace' })"
                class="flex items-center justify-center w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all duration-200"
              >
                {{ $t('common.auth.login') }}
              </NuxtLink>

              <NuxtLink
                :to="localePath({ name: 'autorizace', query: { mode: 'register' } })"
                class="flex items-center justify-center w-full py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 font-semibold text-sm transition-all duration-200"
              >
                {{ $t('common.auth.register') }}
              </NuxtLink>
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
const localePath = useLocalePath()
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
