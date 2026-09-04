<template>
  <ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
    <li v-for="option in options" :key="option.id" class="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <UIcon :name="option.icon" class="mt-0.5 size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />

      <div class="min-w-0 flex-1">
        <label :for="option.id" class="cursor-pointer text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {{ $t(option.title) }}
        </label>
        <p class="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400 text-pretty">{{ $t(option.description) }}</p>
      </div>

      <USwitch
        :id="option.id"
        :modelValue="option.model.value"
        :aria-label="$t(option.title)"
        class="mt-0.5 shrink-0"
        @update:modelValue="option.model.value = $event"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
const allowNotifs = defineModel<boolean | undefined>('allowNotifs')
const allowEmail = defineModel<boolean | undefined>('allowEmail')

// Refs nested in an array are not auto-unwrapped in templates, hence `option.model.value` on the v-model.
const options = [
  {
    id: useId(),
    model: allowNotifs,
    icon: 'mdi:web',
    title: 'profile.webNotifications',
    description: 'profile.webNotificationsDescription',
  },
  {
    id: useId(),
    model: allowEmail,
    icon: 'mdi:email-outline',
    title: 'profile.emailNotifications',
    description: 'profile.emailNotificationsDescription',
  },
]
</script>
