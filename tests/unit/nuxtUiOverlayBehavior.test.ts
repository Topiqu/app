// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

import UModal from '../../node_modules/@nuxt/ui/dist/runtime/components/Modal.vue'
import UButton from '../../node_modules/@nuxt/ui/dist/runtime/components/Button.vue'
import UPopover from '../../node_modules/@nuxt/ui/dist/runtime/components/Popover.vue'
import URadioGroup from '../../node_modules/@nuxt/ui/dist/runtime/components/RadioGroup.vue'
import UDropdownMenu from '../../node_modules/@nuxt/ui/dist/runtime/components/DropdownMenu.vue'

const waitForOverlay = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 30))
}

const PopoverHarness = defineComponent({
  components: { UButton, UPopover },
  template: `
    <UPopover>
      <UButton label="Notifications" />
      <template #content>
        <UButton label="First notification" />
      </template>
    </UPopover>
  `,
})

const DropdownHarness = defineComponent({
  components: { UButton, UDropdownMenu },
  setup: () => ({ items: [[{ label: 'Profile', icon: 'i-mdi-account' }]] }),
  template: '<UDropdownMenu :items="items"><UButton label="Account" /></UDropdownMenu>',
})

const RadioHarness = defineComponent({
  components: { URadioGroup },
  setup: () => ({ value: ref<string | null>(null), items: ['Free', 'Pro', 'Premium'] }),
  template: '<URadioGroup v-model="value" :items="items" orientation="horizontal" />',
})

const ModalHarness = defineComponent({
  components: { UButton, UModal },
  template: `
    <UModal title="Delete article" description="This cannot be undone.">
      <UButton label="Open confirmation" />
      <template #body><UButton label="Cancel" /></template>
      <template #footer><UButton label="Delete" /></template>
    </UModal>
  `,
})

enableAutoUnmount(afterEach)

describe('real Nuxt UI overlay and keyboard behavior', () => {
  it('opens a popover and returns focus to its trigger after Escape', async () => {
    const wrapper = await mountSuspended(PopoverHarness, { attachTo: document.body })
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await waitForOverlay()
    expect(document.body.textContent).toContain('First notification')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await waitForOverlay()
    expect(document.body.textContent).not.toContain('First notification')
    expect(document.activeElement).toBe(trigger.element)
  })

  it('closes a popover on an outside pointer interaction', async () => {
    const wrapper = await mountSuspended(PopoverHarness, { attachTo: document.body })
    await wrapper.get('button').trigger('click')
    await waitForOverlay()
    expect(document.body.textContent).toContain('First notification')

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitForOverlay()
    expect(document.body.textContent).not.toContain('First notification')
  })

  it('opens and dismisses a dropdown menu with the keyboard', async () => {
    const wrapper = await mountSuspended(DropdownHarness, { attachTo: document.body })
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'Enter' })
    await waitForOverlay()
    expect(document.body.textContent).toContain('Profile')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await waitForOverlay()
    expect(document.body.textContent).not.toContain('Profile')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger.element))
  })

  it('selects onboarding-style radio cards with arrow keys', async () => {
    const wrapper = await mountSuspended(RadioHarness, { attachTo: document.body })
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios).toHaveLength(3)

    await radios[0]!.trigger('click')
    await nextTick()
    const selectedRadio = wrapper.findAll('[role="radio"]')[0]!
    ;(selectedRadio.element as HTMLElement).focus()
    selectedRadio.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }),
    )
    await waitForOverlay()

    expect(document.activeElement).toBe(wrapper.findAll('[role="radio"]')[1]!.element)
    expect(wrapper.vm.value).toBe('Pro')
  })

  it('uses a labelled, viewport-safe modal with one scrollable body', async () => {
    const wrapper = await mountSuspended(ModalHarness, { attachTo: document.body })
    await wrapper.get('button').trigger('click')
    await waitForOverlay()

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog.querySelector('[data-slot="body"]')?.className).toContain('overflow-y-auto')
  })

  it('traps focus and returns it to the modal trigger after Escape', async () => {
    const wrapper = await mountSuspended(ModalHarness, { attachTo: document.body })
    const trigger = wrapper.get('button')
    await trigger.trigger('click')
    await waitForOverlay()

    const cancel = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Cancel')
    cancel?.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).not.toBe(document.body)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await waitForOverlay()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('closes a modal on an outside pointer interaction and restores focus', async () => {
    const wrapper = await mountSuspended(ModalHarness, { attachTo: document.body })
    const trigger = wrapper.get('button')
    await trigger.trigger('click')
    await waitForOverlay()

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    const overlay = dialog.parentElement
    overlay?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitForOverlay()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })
})
