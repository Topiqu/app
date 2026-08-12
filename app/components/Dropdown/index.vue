<template>
  <Menu v-slot="{ open }" :as class="relative inline-block text-left">
    <!-- Float already wraps the floating node in a HeadlessUI transition, so the enter/leave classes
         belong on it. A nested `<transition>` mounted the panel on a different tick than Float's
         positioning pass, leaving it at the document origin while HeadlessUI focused it — with
         `scroll-behavior: smooth` on `*` that reads as the page scrolling itself to the top. -->
    <Float
      placement="bottom-end"
      :offset="8"
      :zIndex="Z_LAYERS.popover"
      flip
      shift
      portal
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-in"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
    >
      <MenuButton as="template">
        <slot :open />
      </MenuButton>

      <MenuItems
        class="w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-xl bg-white! dark:bg-gray-900! shadow-xl ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
      >
        <div v-for="(items, key) in groups" :key class="px-1 py-1 bg-transparent!">
          <MenuItem v-for="item in items" :key="item.id" v-slot="{ active }" :disabled="item.disabled">
            <component
              :is="item.href ? NuxtLink : 'button'"
              :to="item.href"
              :type="item.href ? undefined : 'button'"
              :class="[
                active
                  ? 'bg-violet-600! text-white!'
                  : 'bg-transparent! text-gray-900! dark:text-gray-100! hover:bg-gray-100! dark:hover:bg-gray-800!',
                'group flex w-full items-center rounded-md px-2 py-2 text-sm border-none text-left',
              ]"
              @click="item.onClick"
            >
              <Icon
                v-if="item.icon"
                :name="item.icon"
                :class="[active ? 'text-violet-200' : 'text-violet-600 dark:text-violet-400', 'mr-2 h-5 w-5']"
                aria-hidden="true"
              />
              {{ item.label }}
            </component>
          </MenuItem>
        </div>
      </MenuItems>
    </Float>
  </Menu>
</template>

<script lang="ts" setup>
import { NuxtLink } from '#components'
import { Float } from '@headlessui-float/vue'
import { Z_LAYERS } from '~~/shared/utils/z-layers'
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
