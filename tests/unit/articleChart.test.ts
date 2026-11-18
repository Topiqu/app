// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import Chart from '../../app/components/Article/Chart.vue'
import {
  chartTicks,
  isChartKind,
  parseChartNumber,
  readChart,
  readChartUnit,
  type ChartData,
} from '../../shared/utils/articleChart'

enableAutoUnmount(afterEach)

describe('parseChartNumber', () => {
  it.each([
    ['1 410 964 Kč', 1410964],
    ['1\u00a0410\u00a0964\u00a0Kč', 1410964],
    ['1\u202f250,5 €', 1250.5],
    ['12,5 %', 12.5],
    ['3,5', 3.5],
    ['0,125', 0.125],
    ['1.250,50 €', 1250.5],
    ['1.250', 1250],
    ['€1,250.50', 1250.5],
    ['1,250', 1250],
    ['12,500,000', 12500000],
    ['1.5', 1.5],
    ['1234,5', 1234.5],
    ["CHF 1'250.–", 1250],
    ['1 200,- Kč', 1200],
    ['2024', 2024],
    ['120 m²', 120],
    ['+3,2 %', 3.2],
    ['−4 %', -4],
    ['-12', -12],
    ['– 5 %', -5],
    ['€-5', -5],
    ['USD 42', 42],
    ['0', 0],
  ])('reads %j as %d', (text, value) => {
    expect(parseChartNumber(text)).toBe(value)
  })

  it.each([
    '',
    'n/a',
    'zdarma',
    '10–20',
    '10 - 20',
    '2 500 Kč – 3 000 Kč',
    '12 % (2023)',
    '10 20',
    '1.5.2024',
    '12:30',
    '1/3',
    'CO2',
    'Q1',
    '1.2.3',
    '1,2.5',
    '12, 15',
  ])('rejects %j', (text) => {
    expect(parseChartNumber(text)).toBeNull()
  })

  it('does not read a dash that separates a word from the number as a minus', () => {
    expect(parseChartNumber('Leden – 12')).toBe(12)
  })
})

describe('readChart', () => {
  const sales = [
    ['Kraj', 'Poznámka', 'Tržby', 'Zisk'],
    ['Praha', 'centrála', '1 410 964 Kč', '120 000 Kč'],
    ['Brno', 'pobočka', '980 000 Kč', ''],
    ['Ostrava', 'pobočka', '–', '-15 000 Kč'],
  ]

  it('reads a bar chart, ignoring the text column and keeping raw labels', () => {
    expect(readChart('bar', sales)).toEqual({
      kind: 'bar',
      categories: ['Praha', 'Brno', 'Ostrava'],
      series: [
        { name: 'Tržby', values: [1410964, 980000, null], labels: ['1 410 964 Kč', '980 000 Kč', '–'] },
        { name: 'Zisk', values: [120000, null, -15000], labels: ['120 000 Kč', '', '-15 000 Kč'] },
      ],
    } satisfies ChartData)
  })

  it('reads a line chart with gaps', () => {
    const rows = [
      ['Rok', 'Podíl'],
      ...['2020', '2021', '2022', '2023'].map((year, i) => [year, i === 1 ? '' : `${i * 5} %`]),
    ]
    expect(readChart('line', rows)).toEqual({
      kind: 'line',
      categories: ['2020', '2021', '2022', '2023'],
      series: [{ name: 'Podíl', values: [0, null, 10, 15], labels: ['0 %', '', '10 %', '15 %'] }],
    })
  })

  it('collapses markup whitespace but keeps the NBSPs inside a number', () => {
    const chart = readChart('bar', [
      ['A', 'B'],
      ['x\n  y', '1\u00a0000'],
      ['z', '2\u00a0000'],
    ])
    expect(chart?.categories).toEqual(['x y', 'z'])
    expect(chart?.series[0]?.labels).toEqual(['1\u00a0000', '2\u00a0000'])
  })

  it('drops blank rows and spanning note rows', () => {
    const chart = readChart('bar', [['A', 'B'], ['x', '1'], ['', ''], ['y', '2'], ['Zdroj: ČSÚ']])
    expect(chart?.categories).toEqual(['x', 'y'])
  })

  it('ignores a column that mixes units', () => {
    const chart = readChart('bar', [
      ['A', 'Mixed', 'Clean'],
      ['x', '1,2 mil. Kč', '1'],
      ['y', '850 tis. Kč', '2'],
    ])
    expect(chart?.series.map((item) => item.name)).toEqual(['Clean'])
  })

  it('ignores an all-empty column', () => {
    expect(
      readChart('bar', [
        ['A', 'B', 'C'],
        ['x', '', '1'],
        ['y', '–', '2'],
      ])?.series,
    ).toHaveLength(1)
  })

  it.each([
    [
      'an unknown kind',
      'pie',
      [
        ['A', 'B'],
        ['x', '1'],
        ['y', '2'],
      ],
    ],
    [
      'a missing kind',
      null,
      [
        ['A', 'B'],
        ['x', '1'],
        ['y', '2'],
      ],
    ],
    [
      'one category',
      'bar',
      [
        ['A', 'B'],
        ['x', '1'],
      ],
    ],
    [
      'no numeric column',
      'bar',
      [
        ['A', 'B'],
        ['x', 'yes'],
        ['y', 'no'],
      ],
    ],
    ['a header only', 'line', [['A', 'B']]],
    [
      'five numeric columns',
      'bar',
      [
        ['A', '1', '2', '3', '4', '5'],
        ['x', '1', '1', '1', '1', '1'],
        ['y', '2', '2', '2', '2', '2'],
      ],
    ],
  ] as const)('rejects %s', (_, kind, rows) => {
    expect(
      readChart(
        kind,
        rows.map((row) => [...row]),
      ),
    ).toBeNull()
  })

  it('caps categories at 24 for bars and 60 for lines', () => {
    const rows = (count: number) => [['A', 'B'], ...Array.from({ length: count }, (_, i) => [`c${i}`, String(i)])]
    expect(readChart('bar', rows(24))).not.toBeNull()
    expect(readChart('bar', rows(25))).toBeNull()
    expect(readChart('line', rows(60))).not.toBeNull()
    expect(readChart('line', rows(61))).toBeNull()
  })

  it('accepts four numeric columns', () => {
    expect(
      readChart('bar', [
        ['A', '1', '2', '3', '4'],
        ['x', '1', '1', '1', '1'],
        ['y', '2', '2', '2', '2'],
      ])?.series,
    ).toHaveLength(4)
  })

  it('guards the kind', () => {
    expect(isChartKind('bar')).toBe(true)
    expect(isChartKind('line')).toBe(true)
    expect(isChartKind('pie')).toBe(false)
    expect(isChartKind(undefined)).toBe(false)
  })
})

describe('readChartUnit', () => {
  const series = (...labels: string[]) => [{ name: '', values: [], labels }]

  it('keeps a shared suffix with its spacing', () => {
    expect(readChartUnit(series('12 %', '–', '-3 %'))).toEqual({ prefix: '', suffix: '\u00a0%' })
    expect(readChartUnit(series('12%', '3%'))).toEqual({ prefix: '', suffix: '%' })
  })

  it('keeps a shared prefix', () => {
    expect(readChartUnit(series('€12', '€-5'))).toEqual({ prefix: '€', suffix: '' })
  })

  it('drops units that differ or are too long for an axis', () => {
    expect(readChartUnit([...series('12 Kč'), ...series('3 %')])).toEqual({ prefix: '', suffix: '' })
    expect(readChartUnit(series('12 Kč/měsíc', '3 Kč/měsíc'))).toEqual({ prefix: '', suffix: '' })
  })
})

describe('chartTicks', () => {
  it.each([
    [0, 100, [0, 25, 50, 75, 100]],
    [3, 10, [2, 4, 6, 8, 10]],
    [-5, 12, [-5, 0, 5, 10, 15]],
    [0, 1, [0, 0.25, 0.5, 0.75, 1]],
    [0.3, 0.9, [0.2, 0.4, 0.6, 0.8, 1]],
    [10_500_000, 10_900_000, [10_500_000, 10_600_000, 10_700_000, 10_800_000, 10_900_000]],
    [5, 5, [0, 2, 4, 6]],
    [0, 0, [0, 0.25, 0.5, 0.75, 1]],
  ])('covers %d…%d with round ticks', (min, max, ticks) => {
    expect(chartTicks(min, max)).toEqual(ticks)
  })

  it('always returns 3 to 5 ticks', () => {
    for (const [min, max] of [
      [0, 7],
      [1, 1.3],
      [-0.02, 0.07],
      [123, 98765],
      [-1e6, -2e5],
    ] as const) {
      const ticks = chartTicks(min, max)
      expect(ticks.length).toBeGreaterThanOrEqual(3)
      expect(ticks.length).toBeLessThanOrEqual(5)
      expect(ticks[0]).toBeLessThanOrEqual(min)
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max)
    }
  })
})

describe('Article chart', () => {
  const html = '<table><tr><th>Kraj</th><th>Tržby</th></tr><tr><td>Praha</td><td>10</td></tr></table>'

  it('renders bars from the zero baseline with raw value labels and the table behind a disclosure', async () => {
    const chart = readChart('bar', [
      ['Kraj', 'Zisk'],
      ['Praha', '10 %'],
      ['Brno', '-5 %'],
    ])!
    const wrapper = await mountSuspended(Chart, { props: { chart, html } })

    const visual = wrapper.find('[role="img"]')
    expect(visual.attributes('aria-label')).toBeTruthy()
    expect(visual.text()).toContain('10 %')
    expect(visual.text()).toContain('-5 %')
    // Range −5…10: zero sits a third of the way in; the negative bar ends there from the right.
    const bars = wrapper.findAll('.rounded-r-\\[4px\\], .rounded-l-\\[4px\\]')
    expect(bars).toHaveLength(2)
    expect(bars[0]!.attributes('style')).toContain('left: 33.3')
    expect(bars[1]!.attributes('style')).toContain('right: 66.6')

    const details = wrapper.find('figure details')
    expect(details.exists()).toBe(true)
    expect(details.find('table').exists()).toBe(true)
  })

  it('draws one path per unbroken run and a dot per value, with a legend for several series', async () => {
    const chart = readChart('line', [
      ['Rok', 'A', 'B'],
      ['2020', '1', '4'],
      ['2021', '2', ''],
      ['2022', '', '6'],
      ['2023', '4', '7'],
    ])!
    const wrapper = await mountSuspended(Chart, { props: { chart, html } })

    // A: 2020–2021 joined, 2023 alone. B: 2020 alone, 2022–2023 joined.
    expect(wrapper.findAll('svg path')).toHaveLength(2)
    expect(wrapper.findAll('[title]').filter((node) => node.find('.rounded-full').exists())).toHaveLength(6)
    expect(wrapper.findAll('[role="img"] ul li')).toHaveLength(2)
  })
})
