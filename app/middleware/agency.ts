import admin from './admin'

/** Blog admins pass the admin checks; a signed-in person without a blog may still run an agency. */
export default defineNuxtRouteMiddleware((to, from) => {
  const role = useAuth().data.value?.user?.role
  const platformHost = isPlatformHost(useRequestURL().hostname, useRuntimeConfig().public.baseDomain)
  if (canOpenAgencyWithoutBlog(role, platformHost)) return
  return admin(to, from)
})
