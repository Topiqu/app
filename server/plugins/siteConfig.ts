/**
 * Site identity per request host. `nuxt-seo-utils` builds `titleTemplate` and `ogSiteName` from
 * `site.name`, so without this every tenant's pages were titled "… | Topiqu AI Blog".
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('site-config:init', async ({ siteConfig, event }) => {
    const tenant = await cachedTenantByHost(event)
    if (!tenant) return

    siteConfig.push({
      _context: `tenant:${tenant.domain}`,
      // Above `SiteConfigPriority.runtime` (0), where the nuxt.config `site` block lands.
      _priority: 1,
      // Sitemap locations, the homepage canonical and robots' `Sitemap:` resolve against it; the
      // platform URL put every blog's sitemap and homepage on topiqu.com.
      url:
        process.env.NODE_ENV === 'production'
          ? `https://${tenant.domain}`
          : getRequestURL(event, { xForwardedHost: true }).origin,
      name: tenant.name,
      // Empty, not omitted: the fallback is the platform's own Czech marketing line, and
      // `nuxt-seo-utils` skips a falsy description rather than emitting it as the tenant's.
      description: tenant.description ?? '',
      defaultLocale: tenant.language,
    })
  })
})
