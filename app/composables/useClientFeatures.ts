import type { ClientSite } from '~/utils/buildClientSettingsForm'

export interface FeatureToggleRequest {
  code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'
  enabled: boolean
  price?: string | null
  minimumBillingDays?: number
}

export const useClientFeatures = (client: Ref<ClientSite | null | undefined>, refresh: () => Promise<unknown>) => {
  const { t } = useI18n()
  const confirm = useConfirm()
  const toast = useToast()
  const { invalidateClientFeatures } = useCacheInvalidation()
  const pending = shallowRef(false)
  let disposed = false
  onScopeDispose(() => {
    disposed = true
  })

  const toggle = async ({ code, enabled, price, minimumBillingDays }: FeatureToggleRequest) => {
    const site = client.value
    if (!site || disposed || pending.value || (site.activeFeatures ?? []).includes(code) === enabled) return
    const current = () => !disposed && client.value?.id === site.id
    const names = { AI: 'ai', SENTIMENT: 'sentiment', ARTICLE_CRONS: 'articleCrons' } as const
    const name = t(`common.features.${names[code]}`)
    const active = site.activeFeatures ?? []
    const disablesDependents =
      !enabled && code === 'AI' && active.some((feature) => feature === 'SENTIMENT' || feature === 'ARTICLE_CRONS')
    pending.value = true
    try {
      const message = [
        t('common.features.toggleMessage', { name }),
        disablesDependents && t('common.features.disableAiMessage'),
        price
          ? t('common.features.togglePrice', {
              price,
              period: t(site.billingPlan === 'ANNUAL' ? 'common.preferences.annualy' : 'common.preferences.monthly'),
            })
          : t('common.features.includedInPlan'),
        price && minimumBillingDays && t('common.features.toggleBilling', { days: minimumBillingDays }),
      ]
        .filter(Boolean)
        .join('\n\n')
      const accepted = await confirm({
        title: t(enabled ? 'common.features.enableTitle' : 'common.features.disableTitle', { name }),
        message,
        confirmText: t(enabled ? 'common.actions.enable' : 'common.actions.disable'),
        cancelText: t('common.actions.cancel'),
        variant: enabled ? 'default' : 'danger',
      })
      if (
        !accepted ||
        !current() ||
        client.value?.plan !== site.plan ||
        client.value?.billingPlan !== site.billingPlan ||
        client.value?.currency !== site.currency ||
        !equalFeatures(client.value?.activeFeatures, site.activeFeatures)
      )
        return

      let result: { activeFeatures: string[]; monthlyPayment: number; annualPayment: number }
      try {
        result = await $fetch<typeof result, '/api/clients/:id/features'>(
          `/api/clients/${site.id}/features` as '/api/clients/:id/features',
          { method: 'PATCH', body: { code, enabled } },
        )
      } catch (error) {
        if (current()) toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.messages.saveFailed')) })
        return
      }
      if (current() && client.value) client.value = { ...client.value, ...result }
      const refreshed = await Promise.allSettled([
        Promise.resolve().then(invalidateClientFeatures),
        ...(current() ? [Promise.resolve().then(refresh)] : []),
      ])
      if (!current()) return
      const refreshFailed = refreshed.some((entry) => entry.status === 'rejected')
      toast.add({
        color: refreshFailed ? 'warning' : 'success',
        title: enabled ? t('common.messages.saveSuccess') : t('common.messages.featureDisabled'),
        ...(refreshFailed ? { description: t('common.features.refreshFailed') } : {}),
      })
    } finally {
      if (!disposed) pending.value = false
    }
  }
  return { pending: readonly(pending), toggle }
}

const equalFeatures = (left?: string[] | null, right?: string[] | null) =>
  (left?.length ?? 0) === (right?.length ?? 0) && (left ?? []).every((code) => right?.includes(code))
