// @vitest-environment nuxt

import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AppMedia from '../../app/components/AppMedia.vue'
import ThemeToggle from '../../app/components/ThemeToggle.vue'
import { resolveTenantTheme, tenantThemeStyle } from '../../app/composables/theme'

afterEach(() => vi.useRealTimers())

describe('stable media and theme controls', () => {
  it('leaves an offscreen lazy image alone instead of timing it out', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AppMedia, {
      props: { alt: 'Source favicon', src: 'https://t1.gstatic.com/faviconV2?url=offscreen' },
      global: { stubs: { UIcon: true, USkeleton: true } },
    })

    vi.advanceTimersByTime(10000)
    await nextTick()

    // The source list sits below the fold, so the browser has not fetched this yet.
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.attributes('data-media-state')).toBe('loading')
  })

  it('still gives up on a priority image that never loads', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AppMedia, {
      props: { alt: 'Hero', src: 'https://t1.gstatic.com/faviconV2?url=stalled', priority: true },
      global: { stubs: { UIcon: true, USkeleton: true } },
    })

    vi.advanceTimersByTime(2000)
    await nextTick()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.attributes('data-media-state')).toBe('fallback')
  })

  it('routes allowlisted images through Nuxt Image with WebP variants', () => {
    const wrapper = mount(AppMedia, {
      props: { alt: 'Article cover', src: 'https://cdn.topiqu.com/article-images/cover.png' },
      global: {
        stubs: {
          NuxtImg: {
            name: 'NuxtImg',
            props: ['src', 'format', 'quality', 'sizes'],
            template: '<span data-nuxt-image />',
          },
          UIcon: true,
          USkeleton: true,
        },
      },
    })

    const image = wrapper.getComponent({ name: 'NuxtImg' })
    expect(image.props()).toMatchObject({ format: 'webp', quality: 82 })
  })

  it('keeps untrusted image hosts outside the server-side proxy', () => {
    const wrapper = mount(AppMedia, {
      props: { alt: 'GIF', src: 'https://media.giphy.com/example.gif' },
      global: { stubs: { UIcon: true, USkeleton: true } },
    })

    expect(wrapper.findComponent({ name: 'NuxtImg' }).exists()).toBe(false)
    expect(wrapper.get('img').attributes('src')).toBe('https://media.giphy.com/example.gif')
  })

  it('renders an article placeholder without a broken image element', () => {
    const wrapper = mount(AppMedia, {
      props: { alt: 'Missing article image', src: null },
      global: { stubs: { UIcon: true, USkeleton: true } },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.attributes('data-media-state')).toBe('fallback')
    expect(wrapper.text()).toContain('Missing article image')
  })

  it('renders a two-character tenant or user monogram', () => {
    const wrapper = mount(AppMedia, {
      props: { alt: 'Tenant logo', fallbackText: 'Česká redakce' },
      global: { stubs: { UIcon: true, USkeleton: true } },
    })
    expect(wrapper.text()).toContain('ČE')
  })

  it('reserves the color-mode control before hydration', () => {
    const wrapper = mount(ThemeToggle, {
      global: {
        stubs: {
          UColorModeButton: {
            template: '<button data-color-mode class="size-10" aria-label="Theme" />',
          },
        },
      },
    })
    expect(wrapper.get('[data-color-mode]').classes()).toContain('size-10')
  })

  it('whitelists tenant accents and supplies a contrasting foreground', () => {
    expect(resolveTenantTheme('violet')).toBe('violet')
    expect(resolveTenantTheme('not-a-color')).toBe('indigo')
    expect(resolveTenantTheme('#ffffff')).toBe('indigo')
    expect(tenantThemeStyle('yellow')).toMatchObject({
      '--topiqu-tenant-accent-light': '#854d0e',
      '--topiqu-tenant-accent-foreground': '#ffffff',
    })
  })
})
