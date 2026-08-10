<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-highlighted tracking-tight">
        {{ $t('landing.onboarding.siteInfo') }}
      </h3>
      <p class="text-[1.05rem] text-muted font-medium leading-relaxed">
        {{ $t('landing.onboarding.siteInfoDesc') }}
      </p>
    </div>

    <div class="space-y-8">
      <UFormField :label="$t('landing.onboarding.siteName')">
        <UInput
          v-model="form.siteName"
          required
          :placeholder="$t('landing.onboarding.siteNamePlaceholder')"
          leadingIcon="i-mdi-web"
          class="w-full"
        />
      </UFormField>

      <div class="space-y-4">
        <UFormField :label="$t('landing.onboarding.domainType')">
          <URadioGroup
            v-model="form.domainType"
            :items="domainOptions"
            valueKey="value"
            variant="card"
            orientation="horizontal"
            class="grid grid-cols-2"
          >
            <template #label="{ item }">
              <span class="flex flex-col gap-1 py-2">
                <UIcon size="28" :name="item.icon" class="text-primary" />
                <span class="font-bold">{{ item.title }}</span>
                <span class="text-xs text-muted">{{ item.subtitle }}</span>
              </span>
            </template>
          </URadioGroup>
        </UFormField>
      </div>

      <div class="space-y-2">
        <UFormField
          :label="
            form.domainType === 'SUBDOMAIN' ? $t('landing.onboarding.subdomain') : $t('landing.onboarding.customDomain')
          "
        >
          <UInput
            v-model="form.domain"
            required
            :placeholder="
              form.domainType === 'SUBDOMAIN' ? $t('landing.onboarding.domainPlaceholder') : 'blog.mycompany.com'
            "
            leadingIcon="i-mdi-link"
            class="w-full"
            @input="userEditedDomain = true"
          >
            <template v-if="form.domainType === 'SUBDOMAIN'" #trailing>
              <span class="whitespace-nowrap font-mono text-muted">.topiqu.com</span>
            </template>
          </UInput>
        </UFormField>
        <UAlert
          v-if="form.domain && domainStatus !== 'idle'"
          :color="domainStatusColor"
          variant="soft"
          :icon="domainStatusIcon"
          :title="$t(`landing.onboarding.domainStatus.${domainStatus}`)"
        />
        <UProgress v-if="domainStatus === 'checking'" class="w-20" />
      </div>
    </div>

    <UButton
      type="submit"
      color="primary"
      variant="solid"
      size="lg"
      :disabled="!canAdvanceStep1"
      class="w-full mt-10"
      trailingIcon="i-mdi-arrow-right"
    >
      {{ $t('common.actions.continue') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { form, userEditedDomain, domainStatus, domainStatusIcon, domainStatusColor, canAdvanceStep1 } = useOnboarding()

const domainOptions = computed(() => [
  {
    value: 'SUBDOMAIN',
    icon: 'i-mdi-web',
    title: $t('landing.onboarding.subdomain'),
    subtitle: '.topiqu.com',
  },
  {
    value: 'CUSTOM',
    icon: 'i-mdi-earth',
    title: $t('landing.onboarding.customDomain'),
    subtitle: $t('landing.onboarding.customDomainExample'),
  },
])
</script>
