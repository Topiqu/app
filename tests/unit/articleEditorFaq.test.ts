// @vitest-environment nuxt

import { createI18n } from 'vue-i18n'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import type { FaqEntry } from '../../shared/utils/articleFaq'

import Faq from '../../app/components/Article/Editor/Faq.vue'

enableAutoUnmount(afterEach)

const mount = (props: { modelValue: FaqEntry[]; disabled?: boolean }) =>
  mountSuspended(Faq, {
    props,
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } }),
      ],
    },
  })

const entry = { question: 'Kdy?', answer: 'Na jaře.' }

describe('Article editor FAQ', () => {
  it('edits a question and its answer without mutating the bound list', async () => {
    const entries = [entry]
    const wrapper = await mount({ modelValue: entries })

    await wrapper.find('input').setValue('Kdy přesně?')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[{ question: 'Kdy přesně?', answer: 'Na jaře.' }]])

    await wrapper.find('textarea').setValue('V březnu.')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[{ question: 'Kdy přesně?', answer: 'V březnu.' }]])
    expect(entries).toEqual([entry])
  })

  it('adds an empty entry and removes one', async () => {
    const wrapper = await mount({ modelValue: [entry] })

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'articles.editor.faq.add')!
      .trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[entry, { question: '', answer: '' }]])

    await wrapper.find('button[aria-label="articles.editor.faq.remove"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[{ question: '', answer: '' }]])
  })

  it('offers only the add action when there is no FAQ, and nothing while locked', async () => {
    const empty = await mount({ modelValue: [] })
    expect(empty.find('section').exists()).toBe(false)
    expect(empty.text()).toContain('articles.editor.faq.add')

    const locked = await mount({ modelValue: [], disabled: true })
    expect(locked.text()).toBe('')

    const lockedEntries = await mount({ modelValue: [entry], disabled: true })
    expect(lockedEntries.find('input').attributes('disabled')).toBeDefined()
    expect(lockedEntries.text()).not.toContain('articles.editor.faq.add')
  })
})
