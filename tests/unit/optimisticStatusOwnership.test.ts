// @vitest-environment nuxt

import { beforeEach, describe, expect, it } from 'vitest'

import { useOptimisticStatus } from '../../app/composables/useOptimisticStatus'

beforeEach(() => clearNuxtState('optimistic-status'))

describe('shared optimistic announcement ownership', () => {
  it('allows the owning request to finish its saving announcement', () => {
    const operation = useOptimisticStatus()
    const sequence = operation.saving()
    operation.saved(sequence)
    expect(operation.status.value).toEqual({ kind: 'saved', sequence: sequence + 1 })
  })

  it('ignores an older request completion while another view is saving', () => {
    const oldView = useOptimisticStatus()
    const newView = useOptimisticStatus()
    const previous = oldView.saving()
    const current = newView.saving()
    oldView.saved(previous)
    oldView.reverted(previous)
    expect(newView.status.value).toEqual({ kind: 'saving', sequence: current })
    newView.reverted(current)
    expect(oldView.status.value.kind).toBe('reverted')
  })

  it('keeps existing unversioned callers compatible', () => {
    const operation = useOptimisticStatus()
    operation.saving()
    operation.saved()
    expect(operation.status.value.kind).toBe('saved')
  })
})
