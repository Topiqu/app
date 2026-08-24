<template>
  <div
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed inset-x-0 bottom-16 z-overlay flex justify-center px-4"
  >
    <Transition
      enterActiveClass="transition duration-200 ease-out"
      enterFromClass="opacity-0 translate-y-3 scale-[0.96]"
      enterToClass="opacity-100 translate-y-0 scale-100"
      leaveActiveClass="transition duration-150 ease-in"
      leaveFromClass="opacity-100 translate-y-0"
      leaveToClass="opacity-0 translate-y-3"
    >
      <div
        v-if="visible"
        :data-network-state="isOnline ? 'online' : 'offline'"
        class="flex items-center gap-2.5 rounded-full px-4 py-2.5 text-inverted shadow-xl transition-colors duration-300"
        :class="isOnline ? 'bg-success' : 'bg-error'"
      >
        <UIcon :name="isOnline ? 'i-mdi-wifi' : 'i-mdi-wifi-off'" size="18" aria-hidden="true" />
        <span class="text-sm font-medium">
          {{ isOnline ? $t('common.connection.online') : $t('common.connection.offline') }}
        </span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const isOnline = useOnline()
const { visible, showIfOffline } = useNetworkPill(isOnline)

onMounted(showIfOffline)
</script>
