// @vitest-environment nuxt

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppMedia from '../../app/components/AppMedia.vue'
import ThemeToggle from '../../app/components/ThemeToggle.vue'
import { resolveTenantTheme, tenantThemeStyle } from '../../app/composables/theme'

describe('stable media and theme controls', () => {
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
