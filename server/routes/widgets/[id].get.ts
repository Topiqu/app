const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)

// Reports the content height to the embedding page, the only thing the frame may tell it.
const resizeScript = (id: string) =>
  `<script>(()=>{const post=()=>parent.postMessage({topiquWidget:${JSON.stringify(id)},height:Math.ceil(document.documentElement.scrollHeight)},'*');new ResizeObserver(post).observe(document.documentElement);addEventListener('load',post)})()</script>`

/**
 * A tenant's HTML widget, served as its own document for a sandboxed iframe. The CSP `sandbox` header (not
 * only the iframe attribute) keeps it an opaque origin even when opened directly: no cookies, no storage,
 * no access to the page or our API.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const site = await tenantByHost(event)
  // Only on the tenant's own verified domain: on *.topiqu.com a hostile script would risk the platform domain.
  if (
    !id ||
    !site ||
    !widgetAllowed('HTML', site) ||
    toHostname(getRequestHost(event, { xForwardedHost: true })) !== site.domain
  )
    throw createError({ statusCode: 404 })

  const widget = await prisma.siteWidget.findFirst({
    where: { id, clientSiteId: site.id, kind: 'HTML', active: true, deletedAt: null },
    select: { config: true },
  })
  const config = widget && htmlConfigSchema.safeParse(widget.config)
  if (!config?.success) throw createError({ statusCode: 404 })

  setResponseHeaders(event, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy':
      "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox; frame-ancestors 'self'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'public, max-age=60',
  })
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(config.data.title)}</title><base target="_blank"><style>html,body{margin:0}</style></head><body>${config.data.html}${resizeScript(id)}</body></html>`
})
