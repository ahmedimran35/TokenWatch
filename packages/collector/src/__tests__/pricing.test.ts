import { calculateCost } from '../pricing'

describe('calculateCost', () => {
  it('calculates cost for known model', () => {
    const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 500_000, 0, 0)
    expect(cost).toBeCloseTo(3 + 7.5, 4)
  })

  it('falls back via prefix matching', () => {
    const cost = calculateCost('claude-sonnet-4-6-20251001', 1_000_000, 0, 0, 0)
    expect(cost).toBeCloseTo(3, 4)
  })

  it('falls back to default pricing for unknown model', () => {
    const cost = calculateCost('unknown-model', 1_000_000, 0, 0, 0)
    expect(cost).toBeGreaterThan(0)
  })

  it('includes cache costs', () => {
    const cost = calculateCost('claude-sonnet-4-6', 0, 0, 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(0.30 + 3.75, 4)
  })
})
