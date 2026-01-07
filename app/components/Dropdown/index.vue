<template>
  <Menu v-slot="{ open }" :as class="relative inline-block text-left">
    <Float placement="bottom-end" :offset="8" portal>
      <MenuButton as="template">
        <slot :open />
      </MenuButton>

      <transition
        enterActiveClass="transition duration-100 ease-out"
        enterFromClass="transform scale-95 opacity-0"
        enterToClass="transform scale-100 opacity-100"
        leaveActiveClass="transition duration-75 ease-in"
        leaveFromClass="transform scale-100 opacity-100"
        leaveToClass="transform scale-95 opacity-0"
        class="z-50"
      >
        <MenuItems
          class="w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          <div v-for="(items, key) in groups" :key class="px-1 py-1">
            <MenuItem v-for="item in items" :key="item.id" v-slot="{ active }" :disabled="item.disabled">
              <div>
                <component
                  :is="item.href ? NuxtLink : 'button'"
                  :to="item.href"
                  :class="[
                    active ? 'bg-violet-600! text-white!' : 'bg-transparent! text-gray-900!',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm border-none',
                  ]"
                  @click="item.onClick"
                >
                  <Icon
                    v-if="item.icon"
                    :name="item.icon"
                    :class="[active ? 'text-violet-200' : 'text-violet-600', 'mr-2 h-5 w-5']"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </component>
              </div>
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Float>
  </Menu>
</template>

<script lang="ts" setup>
import { NuxtLink } from '#components'
import { Float } from '@headlessui-float/vue'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

type Item = {
  id: string
  label: string
  icon?: string
  href?: string
  disabled?: boolean
  onClick?: () => void
}

const { as = 'div', groups } = defineProps<{ as?: string; groups: Item[][] }>()
</script>
