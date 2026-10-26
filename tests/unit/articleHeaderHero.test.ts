// @vitest-environment nuxt

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import ArticleHeaderHero from '../../app/components/Article/Header/Hero.vue'

const { t } = vi.hoisted(() => {
  const messages: Record<string, string> = {
    'articles.image.ai': 'Ilustrační obrázek (AI)',
    'articles.image.aiBadge': 'AI',
  }
  return { t: (key: string) => messages[key] ?? key }
})

mockNuxtImport('useI18n', () => () => ({ t }))

const mountHero = (props: Record<string, unknown>) =>
  mount(ArticleHeaderHero, {
    props: {
      title: 'Gargamel vs. Jotaro',
      author: { username: 'ai' },
      followerCount: 0,
      isFollowing: false,
      showFollowButton: false,
      imageUrl: 'https://cdn.test/cover.jpg',
      ...props,
    },
    global: { mocks: { $t: t }, stubs: { AppMedia: true, UserCard: true } },
  })

describe('ArticleHeaderHero', () => {
  it('marks a generated cover on the picture, only when the tenant discloses AI', () => {
    const shown = mountHero({ imageCredit: { kind: 'ai' }, discloseAi: true })

    expect(shown.text()).toContain('Ilustrační obrázek (AI)')
    expect(shown.find('p').exists()).toBe(false)
    expect(mountHero({ imageCredit: { kind: 'ai' }, discloseAi: false }).text()).not.toContain('AI')
  })
})
