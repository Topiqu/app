<template>
  <section class="@container min-w-0 space-y-5 rounded-(--topiqu-surface-radius) border border-default p-4 sm:p-5">
    <header class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">{{ $t('common.preferences.footer.title') }}</h2>
        <p class="text-sm text-muted">{{ $t('common.preferences.footer.description') }}</p>
      </div>
      <USwitch v-model="settings.enabled" :disabled="!paid" :aria-label="$t('common.preferences.footer.enabled')" />
    </header>
    <UAlert v-if="!paid" color="neutral" icon="mdi:lock-outline" :title="$t('common.preferences.footer.paidOnly')">
      <template #actions>
        <UButton color="neutral" variant="soft" :to="localePath({ name: 'settings', query: { tab: 'billing' } })">
          {{ $t('common.preferences.tabs.billing') }}
        </UButton>
      </template>
    </UAlert>
    <div v-if="settings.enabled" class="space-y-5 border-t border-default pt-5">
      <UFormField :label="$t('common.preferences.footer.text')" :help="$t('common.preferences.footer.textHelp')">
        <UTextarea v-model="settings.text" :disabled="disabled" :maxlength="300" :rows="2" autoresize class="w-full" />
      </UFormField>

      <div class="flex items-start justify-between gap-4 rounded-(--ui-radius) bg-muted p-3">
        <div class="min-w-0 space-y-1">
          <p class="text-sm font-medium text-highlighted">{{ $t('common.preferences.footer.socials') }}</p>
          <p class="text-xs leading-5 text-muted">{{ $t('common.preferences.footer.socialsHelp') }}</p>
        </div>
        <USwitch
          v-model="settings.showSocials"
          :disabled="disabled"
          :aria-label="$t('common.preferences.footer.socials')"
        />
      </div>

      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <h3 class="text-sm font-medium text-highlighted">{{ $t('common.preferences.footer.links') }}</h3>
            <p class="text-xs leading-5 text-muted">
              {{ $t('common.preferences.footer.linksHelp', { count: MAX_FOOTER_LINKS }) }}
            </p>
          </div>
          <span class="shrink-0 text-xs tabular-nums text-muted"
            >{{ settings.links.length }}/{{ MAX_FOOTER_LINKS }}</span
          >
        </div>
        <div
          v-for="(link, index) in settings.links"
          :key="index"
          class="flex min-w-0 items-end gap-2 rounded-(--ui-radius) border border-default p-3"
        >
          <div class="grid min-w-0 flex-1 gap-3 @sm:grid-cols-2">
            <UFormField :label="$t('common.preferences.footer.linkLabel')">
              <UInput v-model="link.label" :disabled="disabled" :maxlength="60" class="w-full" />
            </UFormField>
            <UFormField
              :label="$t('common.preferences.footer.linkUrl')"
              :error="link.url && !isSafeWidgetLink(link.url) ? $t('common.preferences.footer.invalidUrl') : undefined"
            >
              <UInput v-model="link.url" :disabled="disabled" :maxlength="2048" class="w-full" />
            </UFormField>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            square
            icon="mdi:trash-can-outline"
            :disabled="disabled"
            :aria-label="$t('common.actions.delete')"
            @click="settings.links.splice(index, 1)"
          />
        </div>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="mdi:plus"
          :disabled="disabled || settings.links.length >= MAX_FOOTER_LINKS"
          @click="settings.links.push({ label: '', url: '' })"
        >
          {{ $t('common.preferences.footer.addLink') }}
        </UButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { FooterSettings } from '~~/shared/utils/publicationFooter'

const settings = defineModel<FooterSettings>({ required: true })
const props = defineProps<{ plan: string }>()
const localePath = useLocalePath()
const paid = computed(() => hasAdvancedBranding(props.plan))
const disabled = computed(() => !paid.value || !settings.value.enabled)
</script>
