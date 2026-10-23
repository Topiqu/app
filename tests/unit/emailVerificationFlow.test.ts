// @vitest-environment nuxt
import { defineComponent, h, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

import AuthForm from '../../app/components/Auth/Form.vue'
import ProfileEmail from '../../app/components/User/Email.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn(), getSession: vi.fn(), navigate: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useAuth', () => () => ({ data: shallowRef(null), getSession: mocks.getSession }))
mockNuxtImport('useI18n', () => () => ({ locale: shallowRef('en'), t: (key: string) => key }))
mockNuxtImport('useLocalePath', () => () => (route: unknown) => route)
mockNuxtImport('useRequestURL', () => () => new URL('https://app.topiqu.com'))
mockNuxtImport('navigateTo', () => mocks.navigate)

const options = {
  mocks: { $t: (key: string) => key },
  stubs: {
    UCard: { template: '<div><slot /></div>' },
    UFormField: { template: '<div><slot /></div>' },
    UForm: { emits: ['submit'], template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
    UInput: {
      props: ['modelValue', 'type', 'disabled'],
      emits: ['update:modelValue'],
      template:
        '<input :value="modelValue" :type="type || \'text\'" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    UPinInput: {
      props: ['modelValue', 'length', 'type'],
      emits: ['update:modelValue'],
      template:
        '<input :value="(modelValue || []).join(\'\')" :maxlength="length" :type="type" autocomplete="one-time-code" @input="$emit(\'update:modelValue\', $event.target.value.split(\'\'))" />',
    },
    UButton: {
      props: ['type', 'disabled', 'loading'],
      template: '<button :type="type || \'button\'" :disabled="disabled || loading"><slot /></button>',
    },
    UTabs: true,
    USeparator: true,
    AuthLogout: true,
  },
}
const profile = () => {
  const email = shallowRef('reader@example.invalid')
  const verified = shallowRef(false)
  const loading = shallowRef(false)
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(ProfileEmail, {
          email: email.value,
          isEmailVerified: verified.value,
          isLoading: loading.value,
          'onUpdate:email': (value: string) => {
            email.value = value
          },
          'onUpdate:isEmailVerified': (value: boolean) => {
            verified.value = value
          },
          'onUpdate:isLoading': (value: boolean) => {
            loading.value = value
          },
        }),
    }),
    { global: options },
  )
  return { wrapper, email, verified }
}
const button = (wrapper: ReturnType<typeof mount>, key: string) =>
  wrapper.findAll('button').find((item) => item.text() === key)!
const pendingResponse = () => {
  let resolve!: (value: { message: string }) => void
  const promise = new Promise<{ message: string }>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.fetch.mockReset().mockResolvedValue({ message: 'Requested' })
  mocks.getSession.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('email verification consumers', () => {
  it('submits the profile email with the eight-character hexadecimal code', async () => {
    const { wrapper, email, verified } = profile()
    await button(wrapper, 'common.auth.sendCode').trigger('click')
    await flushPromises()
    await wrapper.get('input[autocomplete="one-time-code"]').setValue('AABBCCDD')
    await button(wrapper, 'common.auth.verify').trigger('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      '/api/auth/verify',
      expect.objectContaining({
        body: { email: email.value, code: 'AABBCCDD' },
      }),
    )
    expect(verified.value).toBe(true)
  })

  it('allows a profile resend after the shared cooldown and disposes its timer on unmount', async () => {
    const before = vi.getTimerCount()
    const { wrapper } = profile()
    await button(wrapper, 'common.auth.sendCode').trigger('click')
    await flushPromises()
    expect(button(wrapper, 'common.auth.resendCode').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(60_000)
    await button(wrapper, 'common.auth.resendCode').trigger('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(before)
  })

  it('ignores a profile send response after its displayed account email changes', async () => {
    const pending = pendingResponse()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const { wrapper, email } = profile()
    await button(wrapper, 'common.auth.sendCode').trigger('click')
    email.value = 'another@example.invalid'
    pending.resolve({ message: 'Outdated response' })
    await flushPromises()
    expect(wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(false)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('aborts a profile request and suppresses a late toast when its scope closes', async () => {
    const pending = pendingResponse()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const { wrapper } = profile()
    await button(wrapper, 'common.auth.sendCode').trigger('click')
    const signal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pending.resolve({ message: 'Late response' })
    await flushPromises()
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('lets a password-proven unverified account request a code from the public login flow', async () => {
    mocks.fetch.mockRejectedValueOnce({ data: { message: 'Verify email', data: { code: 'email_not_verified' } } })
    const wrapper = mount(AuthForm, { global: options })
    await wrapper.get('input[type="email"]').setValue('reader@example.invalid')
    await wrapper.get('input[type="password"]').setValue('test-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('input[autocomplete="one-time-code"]').attributes()).toMatchObject({
      type: 'text',
      maxlength: '8',
    })
    await button(wrapper, 'common.auth.resendCode').trigger('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      '/api/auth/resend-verification',
      expect.objectContaining({ body: { email: 'reader@example.invalid' } }),
    )
    expect(button(wrapper, 'common.auth.resendCode').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(button(wrapper, 'common.auth.resendCode').attributes('disabled')).toBeUndefined()
  })

  it('aborts public verification on unmount and prevents a late credential sign-in', async () => {
    mocks.fetch.mockRejectedValueOnce({ data: { message: 'Verify email', data: { code: 'email_not_verified' } } })
    const wrapper = mount(AuthForm, { global: options })
    await wrapper.get('input[type="email"]').setValue('reader@example.invalid')
    await wrapper.get('input[type="password"]').setValue('test-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('input[autocomplete="one-time-code"]').setValue('aabbccdd')
    const pending = pendingResponse()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    await wrapper.get('form').trigger('submit')
    const signal = mocks.fetch.mock.calls.at(-1)![1].signal as AbortSignal | undefined
    mocks.toast.mockClear()
    wrapper.unmount()
    expect(signal?.aborted).toBe(true)
    pending.resolve({ message: 'Verified' })
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
