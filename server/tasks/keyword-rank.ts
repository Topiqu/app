import { checkDueRanks } from '~~/server/utils/keywords/rank'

export default defineMonitoredTask({
  meta: {
    name: 'keyword-rank',
    description: 'Check the Google position of written keyword plan topics on their schedule',
  },
  async run() {
    return { result: await checkDueRanks() }
  },
})
