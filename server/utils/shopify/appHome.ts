const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

// Inline so the CSP nonce covers it; state arrives from `/api/shopify/app/session`.
const SCRIPT = `
const messages = JSON.parse(document.getElementById('topiqu-messages').textContent)
const views = ['loading', 'failed', 'unlinked', 'linked']
const byId = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
const show = (view) => {
  views.forEach((id) => { byId(id).hidden = id !== view })
  byId('billing').hidden = true
}
let waiting

// One automatic trip to plan selection per browser session, re-armed once a plan is active, so a
// declined selection cannot loop while a reinstall still asks again.
const redirectKey = 'topiqu-plan-redirect:' + params.get('shop')
let redirected = false
const storage = (action) => { try { return action(sessionStorage) } catch { return null } }

const render = (state) => {
  if (state.subscribed) storage((store) => store.removeItem(redirectKey))
  // The App Pricing welcome link appends plan_handle; the plan may not be readable yet.
  if (
    state.subscribed === false && state.pricingUrl && !params.has('plan_handle') && !redirected &&
    storage((store) => store.getItem(redirectKey)) !== '1'
  ) {
    redirected = true
    storage((store) => store.setItem(redirectKey, '1'))
    open(state.pricingUrl, '_top')
  }
  if (!state.linked) {
    byId('connect').setAttribute('href', state.linkUrl)
    show('unlinked')
  } else {
    clearInterval(waiting)
    byId('project').textContent = state.project
    byId('plan').textContent = state.plan
    show('linked')
  }
  // Custom elements may override [hidden], so plain wrappers toggle visibility.
  byId('billing').hidden = !state.pricingUrl
  byId('plan-required').hidden = !state.needsPlan
  const pricing = byId('pricing')
  if (state.pricingUrl) pricing.setAttribute('href', state.pricingUrl)
  pricing.textContent = state.subscribed ? messages.managePlan : messages.choosePlan
  pricing.setAttribute('variant', state.needsPlan ? 'primary' : 'secondary')
}

const load = async () => {
  try {
    const response = await fetch('/api/shopify/app/session', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (await shopify.idToken()) },
    })
    if (!response.ok) throw new Error(String(response.status))
    render(await response.json())
  } catch {
    clearInterval(waiting)
    show('failed')
  }
}

byId('connect').addEventListener('click', () => {
  byId('waiting').hidden = false
  clearInterval(waiting)
  const stop = Date.now() + 15 * 60_000
  waiting = setInterval(() => {
    if (Date.now() > stop) clearInterval(waiting)
    else if (!document.hidden) load()
  }, 5000)
})
byId('check').addEventListener('click', load)
byId('retry').addEventListener('click', () => { show('loading'); load() })
load()
`

/** The App Home document Shopify embeds in the store admin. App Bridge must be the first script. */
export const renderShopifyAppHome = (input: {
  lang: string
  clientId: string
  nonce: string
  openUrl: string
  t: (key: string) => string
}) => {
  const t = (key: string) => escapeHtml(input.t(key))
  const messages = JSON.stringify({
    choosePlan: input.t('common.shopify.app.choosePlan'),
    managePlan: input.t('common.shopify.app.managePlan'),
  }).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="${escapeHtml(input.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="shopify-api-key" content="${escapeHtml(input.clientId)}">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<script src="https://cdn.shopify.com/shopifycloud/polaris-1.js"></script>
<title>Topiqu</title>
</head>
<body>
<s-page heading="Topiqu">
  <s-section>
    <s-paragraph>${t('common.shopify.app.about')}</s-paragraph>
  </s-section>
  <div id="billing" hidden>
    <s-section>
      <s-stack gap="base">
        <div id="plan-required" hidden>
          <s-banner tone="warning" heading="${t('common.shopify.app.planRequiredTitle')}">${t('common.shopify.app.planRequired')}</s-banner>
        </div>
        <div><s-button id="pricing" target="_top"></s-button></div>
      </s-stack>
    </s-section>
  </div>
  <div id="loading">
    <s-section><s-spinner accessibilityLabel="${t('common.shopify.app.loading')}"></s-spinner></s-section>
  </div>
  <div id="failed" hidden>
    <s-banner tone="critical" heading="${t('common.shopify.app.failed')}">
      <s-button id="retry">${t('common.shopify.app.retry')}</s-button>
    </s-banner>
  </div>
  <div id="unlinked" hidden>
    <s-section heading="${t('common.shopify.app.unlinkedTitle')}">
      <s-stack gap="base">
        <s-paragraph>${t('common.shopify.app.unlinkedDescription')}</s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button id="connect" variant="primary" target="_blank">${t('common.shopify.app.connect')}</s-button>
          <s-button id="check">${t('common.shopify.app.check')}</s-button>
        </s-stack>
        <div id="waiting" hidden><s-paragraph>${t('common.shopify.app.waiting')}</s-paragraph></div>
      </s-stack>
    </s-section>
  </div>
  <div id="linked" hidden>
    <s-section heading="${t('common.shopify.app.linkedTitle')}">
      <s-stack gap="base">
        <s-paragraph>${t('common.shopify.app.project')}: <s-text type="strong" id="project"></s-text></s-paragraph>
        <s-paragraph>${t('common.shopify.app.plan')}: <s-text type="strong" id="plan"></s-text></s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button href="${escapeHtml(input.openUrl)}" target="_blank">${t('common.shopify.app.open')}</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  </div>
</s-page>
<script type="application/json" id="topiqu-messages">${messages}</script>
<script type="module" nonce="${escapeHtml(input.nonce)}">${SCRIPT}</script>
</body>
</html>`
}
