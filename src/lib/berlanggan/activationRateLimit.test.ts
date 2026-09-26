import { describe, expect, it } from 'vitest'

import { checkActivationRateLimit } from './activationRateLimit'

describe('checkActivationRateLimit', () => {
  it('allows up to the limit then locks the key out for the window', () => {
    const key = `test:${Math.random()}`
    const results = Array.from({ length: 10 }, () => checkActivationRateLimit(key))
    // 8 allowed, then false
    expect(results.slice(0, 8).every(Boolean)).toBe(true)
    expect(results[8]).toBe(false)
    expect(results[9]).toBe(false)
  })

  it('tracks keys independently', () => {
    const a = `a:${Math.random()}`
    const b = `b:${Math.random()}`
    for (let i = 0; i < 8; i++) checkActivationRateLimit(a)
    expect(checkActivationRateLimit(a)).toBe(false)
    expect(checkActivationRateLimit(b)).toBe(true)
  })
})
