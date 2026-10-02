<template>
  <section class="space-y-4">
    <div>
      <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.publicationChannels.title') }}</h3>
      <p class="mt-1 max-w-2xl text-sm leading-6 text-muted">
        {{ $t('common.preferences.publicationChannels.description') }}
      </p>
    </div>
    <div
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <div
        v-for="channel in PUBLICATION_CHANNELS"
        :key="channel.key"
        class="flex items-start justify-between gap-5 p-5 sm:p-6"
      >
        <div class="min-w-0">
          <h4 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
            <UIcon :name="channel.icon" class="size-4" />{{
              $t(`common.preferences.publicationChannels.${channel.key}`)
            }}
          </h4>
          <p class="mt-1 max-w-xl text-sm leading-6 text-muted">
            {{ $t(`common.preferences.publicationChannels.${channel.key}Help`) }}
          </p>
          <p class="mt-2 text-xs text-muted">
            {{ $t(`common.preferences.publicationChannels.${availability[channel.key]}`) }}
          </p>
        </div>
        <USwitch
          :modelValue="settings[channel.field]"
          :aria-label="$t(`common.preferences.publicationChannels.${channel.key}`)"
          @update:modelValue="settings = { ...settings, [channel.field]: $event }"
        />
      </div>
    </div>
    <UButton
      :to="localePath({ name: 'settings', query: { tab: 'integrations' } })"
      color="neutral"
      variant="link"
      icon="mdi:puzzle-outline"
    >
      {{ $t('common.preferences.publicationChannels.manageIntegrations') }}
    </UButton>
  </section>
</template>

<script setup lang="ts">
import { PUBLICATION_CHANNELS, type PublicationChannelSettings } from '~~/shared/utils/publicationChannels'

const settings = defineModel<PublicationChannelSettings>({ required: true })
const props = defineProps<{ linkedinConnected: boolean }>()
const { data: shopify } = useShopify()
const availability = computed(() => ({
  web: 'ready',
  shopify:
    shopify.value?.connection?.status === 'CONNECTED' && shopify.value.connection.blogId ? 'ready' : 'needsSetup',
  linkedin: props.linkedinConnected ? 'ready' : 'needsSetup',
}))
const localePath = useLocalePath()
</script>
