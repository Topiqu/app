// @vitest-environment node
/**
 * Live eval of the picture check (`imageDepicts`) on real archive hits for real article slots. Costs real tokens,
 * so it is skipped unless AI_EVAL=1: `bun run eval:ai`. `either` items are judgement calls and not scored.
 * Every wrong pick that reaches an article belongs here as a `reject` case.
 */
import { join } from 'node:path'
import { createAnthropic } from '@ai-sdk/anthropic'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/images/publicFetch'), 'fetchPublicUrl', 'readLimitedBody')
  await stubNitroImports(import('../../server/utils/images/http'), 'fetchJson', 'imageApiHeaders')
}

await stubImports()

const { imageDepicts } = await import('../../server/utils/images/verify')
const { AI_MODELS } = await import('../../server/utils/ai/modelRegistry')

const commons = (file: string) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/${file}/1280px-${file.split('/').pop()}`

const article = {
  frost: {
    title: 'Tepelné čerpadlo v mrazu: kdy při −15 °C dotápí?',
    cover:
      'Při −15 °C rozhoduje o dotápění výkon čerpadla, tepelná ztráta domu a teplota vody v radiátorech. Tepelné čerpadlo v mrazu může dál vytápět dům, i když se při −15 °C zapojí záložní těleso. Náš model HW-12 má provozní rozsah pro vytápění až do −25 °C.',
    radiators:
      'Radiátory a tepelné čerpadlo mohou spolupracovat i ve starším domě. Radiátor však s chladnější vodou předá místnosti méně tepla. Při zaměření proto změříme rozměry radiátorů a spočítáme, jakou výstupní teplotu potřebují při −12 °C.',
  },
  noise: {
    title: 'Jak odhadnout hluk tepelného čerpadla u sousedů?',
    cover:
      'Akustický výkon a tlak nelze porovnávat přímo. Ukážeme na příkladech, co říkají o jednotce a jak odhadnout hluk u sousedova okna. Hluk tepelného čerpadla u sousedů závisí na umístění jednotky i vzdálenosti okna.',
    measuring:
      'Nejprve změřte vzdálenost od plánované venkovní jednotky k nejbližšímu sousedovu oknu. Potom zaznamenejte, zda bude čerpadlo stát ve volném prostoru, u zdi nebo v koutě. V nočním režimu klesá u HW-8 přepočtený tlak v 5 m na 28 dB(A).',
  },
  oldHouse: {
    title: 'Tepelné čerpadlo do starého domu: kdy se vyplatí?',
    cover:
      'Starý dům nemusí čerpadlo vylučovat. Rozhoduje tepelná ztráta, teplota vody v radiátorech a poctivý propočet nákladů. U částečně zatepleného domu může být výměna plynového kotle rozumná už dnes.',
    radiators:
      'Staré litinové radiátory nemusíte automaticky vyhazovat. Podstatné je, kolik tepla předají při nižší teplotě vody. Většinou bylo potřeba vyměnit jeden až tři nejmenší radiátory, často v koupelně nebo chodbě.',
    hydraulics:
      'Čerpadlo má záložní elektrické těleso; bod jeho zapojení bývá obvykle mezi −5 a −10 °C. Účinnost popisuje COP: poměr dodaného tepla ke spotřebované elektřině v daných podmínkách.',
  },
}

type Case = {
  id: string
  expected: 'accept' | 'reject' | 'either'
  url: string
  alt: string
  title: string
  query: string
  wanted: string
  context: string
}

const cases: Case[] = [
  {
    id: 'outdoor unit in snow for the frost cover',
    expected: 'accept',
    url: commons('e/e2/Ecodan_outdoor_unit_in_the_snow.jpg'),
    alt: 'Ecodan outdoor unit in the snow',
    title: article.frost.title,
    query: 'heat pump outdoor unit',
    wanted: 'air source heat pump outdoor unit in snow',
    context: article.frost.cover,
  },
  {
    id: 'outdoor unit by a house wall for the noise cover',
    expected: 'accept',
    url: commons('6/66/Carrier_Outdoor_Split_Air_Conditioner_Heat_Pump_System_%2855005181522%29.jpg'),
    alt: 'Carrier Outdoor Split Air Conditioner Heat Pump System',
    title: article.noise.title,
    query: 'outdoor air-source heat pump unit',
    wanted: 'outdoor air-source heat pump unit',
    context: article.noise.cover,
  },
  {
    id: 'cast iron radiator in an old room',
    expected: 'accept',
    url: commons(
      'a/aa/Ornate_Cast_Iron_Radiator_-_Brian_Eno_Speaker_Flowers_Sound_Installation_at_Marlborough_House.jpg',
    ),
    alt: 'Ornate Cast Iron Radiator',
    title: article.oldHouse.title,
    query: 'cast iron radiator',
    wanted: 'Starší litinový článkový radiátor, který se v domech postavených před rokem 1990 běžně používá.',
    context: article.oldHouse.radiators,
  },
  {
    id: 'tape measure on a radiator',
    expected: 'accept',
    url: commons(
      'c/cc/A_person_is_using_a_tape_measure_to_check_the_dimensions_of_a_radiator_valve_in_a_home_setting.jpg',
    ),
    alt: 'A person is using a tape measure to check the dimensions of a radiator valve in a home setting',
    title: article.frost.title,
    query: 'radiator dimensions measuring tape',
    wanted: 'Měření rozměrů radiátoru svinovacím metrem.',
    context: article.frost.radiators,
  },
  {
    id: 'monobloc unit at an old stone house under renovation',
    expected: 'accept',
    url: commons('5/53/Heat_pump_installation_-_geograph.org.uk_-_7495844.jpg'),
    alt: 'Heat pump installation',
    title: article.oldHouse.title,
    query: 'heat pump installation',
    wanted: 'air-to-water heat pump outdoor unit family house',
    context: article.oldHouse.cover,
  },
  {
    id: 'small split unit on a timber facade',
    expected: 'either',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Sanyo_SAP-KRV-93EHN.jpg',
    alt: 'Sanyo SAP-KRV-93EHN',
    title: article.oldHouse.title,
    query: 'heat pump outdoor unit',
    wanted: 'air-to-water heat pump outdoor unit family house',
    context: article.oldHouse.cover,
  },
  {
    id: 'meter next to a phone app in a lab',
    expected: 'either',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/NIOSHSoundLevelMeterAppTesting.jpg',
    alt: 'NIOSH sound level meter app testing',
    title: article.noise.title,
    query: 'sound level meter',
    wanted: 'Měřicí přístroj s mikrofonem zaznamenává hladinu hluku venku u zdi rodinného domu.',
    context: article.noise.measuring,
  },
  {
    id: 'wall split air conditioner for a hydraulic module',
    expected: 'reject',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Sanyo_SAP-KRV-93EH.jpg',
    alt: 'Sanyo SAP-KRV-93EH',
    title: article.oldHouse.title,
    query: 'heat pump indoor unit',
    wanted: 'Vnitřní hydraulická jednotka tepelného čerpadla s oběhovým čerpadlem a připojením k topné soustavě.',
    context: article.oldHouse.hydraulics,
  },
  {
    id: '1861 catalogue engraving for a radiator in a house',
    expected: 'reject',
    url: commons('a/aa/Cast_Iron_Pedestal_Radiator_No_164_Plate_16_Pascal_Iron_Works_%281861%29.jpg'),
    alt: 'Cast Iron Pedestal Radiator No 164 Plate 16 Pascal Iron Works (1861)',
    title: article.frost.title,
    query: 'cast iron radiator',
    wanted: 'Litinový článkový radiátor ve starším rodinném domě.',
    context: article.frost.radiators,
  },
  {
    id: 'Japanese street noise display for measuring by a house',
    expected: 'reject',
    url: commons('4/45/Sound_level_meter_in_Japan_%284464526592%29.jpg'),
    alt: 'Sound level meter in Japan',
    title: article.noise.title,
    query: 'sound level meter',
    wanted: 'Zvukoměr měří hladinu hluku venku na zahradě u domu.',
    context: article.noise.measuring,
  },
  {
    id: 'inside of an outdoor unit as the frost cover',
    expected: 'reject',
    url: commons('6/6b/Ecodan_outdoor_unit_Internal_view.jpg'),
    alt: 'Ecodan outdoor unit Internal view',
    title: article.frost.title,
    query: 'heat pump outdoor unit',
    wanted: 'air source heat pump outdoor unit in snow',
    context: article.frost.cover,
  },
  {
    id: 'industrial heat pump plant for a family house cover',
    expected: 'reject',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/GEA-heat-pump-redgenium.jpg',
    alt: 'heat pump GEA RedGenium',
    title: article.oldHouse.title,
    query: 'heat pump',
    wanted: 'air-source heat pump outdoor unit beside house',
    context: article.oldHouse.cover,
  },
  {
    id: 'phone app screenshot named "Heat Pump"',
    expected: 'reject',
    url: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource114/v4/22/cc/0e/22cc0ef3-2c0e-0ac6-0084-4d05bc14ef4d/f1bd27bc-2231-47fd-acf4-8ff7e114f940_IMG_3216.PNG/392x696bb.png',
    alt: 'Heat Pump',
    title: article.oldHouse.title,
    query: 'heat pump outdoor unit old house',
    wanted: 'heat pump outdoor unit old house',
    context: article.oldHouse.cover,
  },
]

const results: unknown[] = []

describe.skipIf(process.env.AI_EVAL !== '1')('image check eval', () => {
  beforeAll(() => {
    if (existsSync('.env')) process.loadEnvFile('.env')
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) => anthropic(AI_MODELS[task].id))
  })

  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `image-check-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(results, null, 2))
    console.info(`eval results: ${file}`)
    vi.unstubAllGlobals()
  })

  it.concurrent.each(cases)(
    '$id',
    async ({ id, expected, url, alt, title, query, wanted, context }) => {
      const verdict = await imageDepicts({ url, alt }, { title, query, type: 'stock', wanted, context })
      results.push({ id, expected, ...verdict })
      console.info(id, expected, verdict)
      expect(verdict.failure).toBeUndefined()
      if (expected !== 'either') expect(verdict.depicts).toBe(expected === 'accept')
    },
    60_000,
  )
})

beforeEach(stubImports)
