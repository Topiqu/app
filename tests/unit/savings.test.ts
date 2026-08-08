import { describe, expect, it } from 'vitest'
import { DEFAULT_HOURLY_RATE_USD, DEFAULT_WORDS_PER_HOUR, writingSavings } from '~~/shared/utils/savings'

describe('writing savings', () => {
  it('is words / speed hours, priced at the hourly rate', () => {
    expect(writingSavings(800, 60, 400)).toEqual({
      words: 800,
      hourlyRateUsd: 60,
      wordsPerHour: 400,
      minutes: 120,
      amountUsd: 120,
    })
  })

  it('echoes back the inputs it used, so the UI can show the same numbers it priced with', () => {
    const savings = writingSavings(720)

    expect(savings.hourlyRateUsd).toBe(DEFAULT_HOURLY_RATE_USD)
    expect(savings.wordsPerHour).toBe(DEFAULT_WORDS_PER_HOUR)
    expect(savings.minutes).toBe(108)
    expect(savings.amountUsd).toBe(108)
  })

  it('falls back rather than dividing by zero or pricing at zero', () => {
    expect(writingSavings(400, 0, 0)).toMatchObject({
      hourlyRateUsd: DEFAULT_HOURLY_RATE_USD,
      wordsPerHour: DEFAULT_WORDS_PER_HOUR,
    })
  })

  it('treats a missing or negative word count as nothing saved', () => {
    expect(writingSavings(0).amountUsd).toBe(0)
    expect(writingSavings(-50).minutes).toBe(0)
    expect(writingSavings(Number.NaN).words).toBe(0)
  })

  it('rounds money to cents rather than leaking float noise', () => {
    expect(writingSavings(333, 60, 400).amountUsd).toBe(49.95)
  })
})
