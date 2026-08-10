<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-highlighted tracking-tight">
        {{ $t('landing.onboarding.summary') }}
      </h3>
      <p class="text-[1.05rem] text-muted font-medium leading-relaxed">
        {{ $t('landing.onboarding.summaryDesc') }}
      </p>
    </div>

    <UCard>
      <div v-for="(row, index) in summaryRows" :key="row.label">
        <div class="flex items-center gap-4 px-5 py-4">
          <UIcon :name="row.icon" size="20" class="shrink-0" />
          <span class="w-40 shrink-0 text-sm font-bold uppercase tracking-wide text-muted">{{ row.label }}</span>
          <span class="break-words text-right font-black text-highlighted">{{ row.value }}</span>
        </div>
        <USeparator v-if="index < summaryRows.length - 1" />
      </div>
    </UCard>

    <UFormField name="acceptTos">
      <UCheckbox v-model="form.acceptTos">
        <template #label>
          <span class="text-sm font-bold leading-relaxed">
            <i18n-t keypath="landing.onboarding.acceptTos" tag="span">
              <template #tos>
                <ULink :to="localePath({ name: 'tos' })" target="_blank" @click.stop>
                  {{ $t('landing.onboarding.acceptTosLabel') }}
                </ULink>
              </template>
              <template #privacy>
                <ULink :to="localePath({ name: 'privacy' })" target="_blank" @click.stop>
                  {{ $t('landing.onboarding.acceptPrivacyLabel') }}
                </ULink>
              </template>
            </i18n-t>
          </span>
        </template>
      </UCheckbox>
    </UFormField>

    <div class="flex gap-4 mt-4">
      <UButton type="button" color="neutral" variant="soft" size="lg" class="w-1/3" @click="goBack(5)">
        {{ $t('common.actions.back') }}
      </UButton>
      <UButton
        type="submit"
        color="primary"
        variant="solid"
        size="lg"
        :loading="loading"
        :disabled="!form.acceptTos || loading"
        class="w-2/3"
        icon="i-mdi-rocket-launch"
      >
        {{ $t('landing.onboarding.createAccount') }}
      </UButton>
    </div>

    <UAlert
      color="primary"
      variant="soft"
      icon="i-mdi-sparkles"
      :description="$t('landing.onboarding.trialHintToken')"
    />
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { form, loading, summaryRows, goBack } = useOnboarding()
</script>
