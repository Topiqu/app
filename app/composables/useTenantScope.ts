import type { TenantScope } from '~~/generated/zenstack/models'

/** UI gating only; every endpoint enforces its scope itself. */
export const useTenantScope = () => {
  const { data } = useAuth()
  return (scope: TenantScope) => !!data.value?.user.scopes.includes(scope)
}
