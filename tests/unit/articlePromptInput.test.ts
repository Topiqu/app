// @vitest-environment nuxt

import { nextTick } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import PromptInput from '../../app/components/Article/Editor/PromptInput.vue'

enableAutoUnmount(afterEach)

const sample = `**Úhel:** Osobní srovnání Witcher 3 Remasteru a Next-Gen verze s důrazem na to, proč vám výsledek příliš nesedí.  
**Pro koho:** Pro hráče, kteří zvažují, kterou verzi hrát.  
**Věnujte se:** výkonu, kvalitě gameplaye a vizuálnímu zpracování. U každého bodu uveďte, co vám vyhovuje a co ne; konkrétní výhrady doplňte podle vlastní zkušenosti.`

const mountInput = async (modelValue = sample) => {
  const wrapper = await mountSuspended(PromptInput, {
    props: { modelValue, label: 'Zadání', placeholder: 'Co chcete napsat?' },
    attachTo: document.body,
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  await nextTick()
  return wrapper
}

describe('AI generation prompt input', () => {
  it('renders the user’s Markdown labels in bold without changing the prompt', async () => {
    const wrapper = await mountInput()

    expect(wrapper.findAll('strong').map((node) => node.text())).toEqual(['Úhel:', 'Pro koho:', 'Věnujte se:'])
    expect(wrapper.text()).toContain('Witcher 3 Remasteru')
    expect(wrapper.text()).not.toContain('**')
    expect(wrapper.get('[role="textbox"]').attributes('aria-label')).toBe('Zadání')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('renders AI improvements and undo without emitting normalized replacements', async () => {
    const wrapper = await mountInput('Původní zadání')
    await wrapper.setProps({ modelValue: sample })
    expect(wrapper.findAll('strong')).toHaveLength(3)

    await wrapper.setProps({ modelValue: 'Původní zadání' })
    expect(wrapper.text()).toBe('Původní zadání')
    expect(wrapper.findAll('strong')).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps Markdown bold labels in the string sent back after editing', async () => {
    const wrapper = await mountInput()
    const editor = wrapper.findComponent(EditorContent).props('editor')
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' Doplnění.')
    await nextTick()

    const value = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string
    expect(value).toContain('**Úhel:**')
    expect(value).toContain('**Pro koho:**')
    expect(value).toContain('**Věnujte se:**')
    expect(value).toContain('Doplnění.')
    expect(value).not.toContain('<strong>')
  })

  it('formats a plain-text Markdown paste inside the editable field', async () => {
    const wrapper = await mountInput('')
    expect(wrapper.get('[role="textbox"]').classes()).toContain('is-empty')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type: string) => (type === 'text/plain' ? sample : '') },
    })
    wrapper.get('[role="textbox"]').element.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.findAll('strong')).toHaveLength(3)
    expect(wrapper.get('[role="textbox"]').classes()).not.toContain('is-empty')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('**Úhel:**')
  })

  it('updates the placeholder when the output format changes', async () => {
    const wrapper = await mountInput('')
    await wrapper.setProps({ placeholder: 'Popište příběh' })
    expect(wrapper.get('[role="textbox"]').attributes('data-placeholder')).toBe('Popište příběh')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('disables editing during generation without changing the stored prompt', async () => {
    const wrapper = await mountInput()
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[role="textbox"]').attributes('contenteditable')).toBe('false')
    expect(wrapper.get('[role="textbox"]').attributes('aria-disabled')).toBe('true')

    await wrapper.setProps({ disabled: false })
    expect(wrapper.get('[role="textbox"]').attributes('contenteditable')).toBe('true')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
