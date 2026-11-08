// @vitest-environment nuxt

import { createI18n } from 'vue-i18n'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import Summary from '../../app/components/Article/Editor/Summary.vue'

enableAutoUnmount(afterEach)

const mount = (props: { answer: string | null; takeaways: string[]; disabled?: boolean }) =>
  mountSuspended(Summary, {
    props,
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } }),
      ],
    },
  })

const buttonWith = (wrapper: Awaited<ReturnType<typeof mount>>, label: string) =>
  wrapper.findAll('button').find((button) => button.text() === label)!

describe('Article editor summary', () => {
  it('edits the answer and every takeaway without mutating the bound array', async () => {
    const takeaways = ['First', 'Second']
    const wrapper = await mount({ answer: 'Answer', takeaways })

    await wrapper.find('textarea').setValue('New answer')
    expect(wrapper.emitted('update:answer')?.at(-1)).toEqual(['New answer'])

    await wrapper.findAll('input')[1]!.setValue('Changed')
    expect(wrapper.emitted('update:takeaways')?.at(-1)).toEqual([['First', 'Changed']])
    expect(takeaways).toEqual(['First', 'Second'])
  })

  it('stores an emptied answer as null and keeps the field open', async () => {
    const wrapper = await mount({ answer: 'Answer', takeaways: [] })
    await wrapper.find('textarea').setValue('')
    await wrapper.setProps({ answer: null })

    expect(wrapper.emitted('update:answer')?.at(-1)).toEqual([null])
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('adds and removes takeaways and offers the answer when there is none', async () => {
    const wrapper = await mount({ answer: null, takeaways: ['First'] })
    expect(wrapper.find('textarea').exists()).toBe(false)

    await buttonWith(wrapper, 'articles.editor.summary.addAnswer').trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)

    await buttonWith(wrapper, 'articles.editor.summary.addTakeaway').trigger('click')
    expect(wrapper.emitted('update:takeaways')?.at(-1)).toEqual([['First', '']])

    await wrapper.find('button[aria-label="articles.editor.summary.removeTakeaway"]').trigger('click')
    expect(wrapper.emitted('update:takeaways')?.at(-1)).toEqual([['']])
  })

  it('offers no additions while generation or translation owns the fields', async () => {
    const wrapper = await mount({ answer: null, takeaways: ['First'], disabled: true })
    expect(wrapper.text()).not.toContain('articles.editor.summary.addTakeaway')
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })
})
