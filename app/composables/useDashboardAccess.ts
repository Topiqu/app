import type { Ref } from 'vue'

import { isRootHost } from '~~/shared/utils/domain'

/** UI gating only: tenant authorization remains enforced at each server endpoint. */
export const useDashboardAccess = (clientSite: Readonly<Ref<{ id: string } | null | undefined>>) => {
  const { data: auth } = useAuth()
  const route = useRoute()
  const preview = useWidgetPagePreview()
  const hostname = useRequestURL().hostname
  const baseDomain = useRuntimeConfig().public.baseDomain
  const platformHost = isRootHost(hostname, baseDomain) || ['localhost', '127.0.0.1'].includes(hostname)

  return computed(
    () =>
      !preview.active.value &&
      canRenderDashboardShell(auth.value?.user.role, {
        platformHost,
        hostTenantId: clientSite.value?.id,
        sessionTenantId: auth.value?.user.clientSiteId,
        dashboardSidebar: route.meta.dashboardSidebar,
      }),
  )
}
