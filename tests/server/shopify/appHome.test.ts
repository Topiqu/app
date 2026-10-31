// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderShopifyAppHome } from '../../../server/utils/shopify/appHome'

const PRICING = 'https://admin.shopify.com/store/store/charges/topiqu/pricing_plans'

describe('Shopify App Home plan selection', () => {
  let state: Record<string, unknown>
  const open = vi.fn()

  const boot = async (search = '?shop=store.myshopify.com') => {
    const html = renderShopifyAppHome({
      lang: 'en',
      clientId: 'client',
      nonce: 'nonce',
      openUrl: 'https://app.topiqu.com/en/start',
      t: (key) => key,
    })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    document.body.innerHTML = doc.body.innerHTML
    window.history.replaceState(null, '', `/shopify${search}`)
    const script = doc.querySelector('script[nonce]')!.textContent!
    new Function(script)()
    await vi.waitFor(() => expect(document.getElementById('loading')!.hidden).toBe(true))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    state = {
      linked: false,
      linkUrl: 'https://app.topiqu.com/link',
      subscribed: false,
      needsPlan: true,
      pricingUrl: PRICING,
    }
    vi.stubGlobal('open', open)
    vi.stubGlobal('shopify', { idToken: async () => 'id-token' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(state))),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends a fresh install without a plan to plan selection before linking, once per session', async () => {
    await boot()
    expect(open).toHaveBeenCalledWith(PRICING, '_top')
    expect(document.getElementById('billing')!.hidden).toBe(false)
    expect(document.getElementById('unlinked')!.hidden).toBe(false)
    expect(document.getElementById('pricing')!.getAttribute('href')).toBe(PRICING)

    open.mockClear()
    await boot()
    expect(open).not.toHaveBeenCalled()
  })

  it('asks again after a plan was active, so a reinstall requests approval again', async () => {
    await boot()
    state = { ...state, subscribed: true, needsPlan: false }
    await boot()
    state = { ...state, subscribed: false, needsPlan: true }
    open.mockClear()
    await boot()
    expect(open).toHaveBeenCalledWith(PRICING, '_top')
  })

  it('does not redirect from the welcome link or when the subscription is unknown', async () => {
    await boot('?shop=store.myshopify.com&plan_handle=pro')
    expect(open).not.toHaveBeenCalled()
    state = { ...state, subscribed: null, needsPlan: false }
    await boot()
    expect(open).not.toHaveBeenCalled()
    expect(document.getElementById('pricing')!.textContent).toBe('common.shopify.app.choosePlan')
  })

  it('offers plan management to a linked store with an active plan', async () => {
    state = { linked: true, project: 'Blog', plan: 'PRO', subscribed: true, needsPlan: false, pricingUrl: PRICING }
    await boot()
    expect(open).not.toHaveBeenCalled()
    expect(document.getElementById('linked')!.hidden).toBe(false)
    expect(document.getElementById('plan-required')!.hidden).toBe(true)
    expect(document.getElementById('pricing')!.textContent).toBe('common.shopify.app.managePlan')
  })
})
