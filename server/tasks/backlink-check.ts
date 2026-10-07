import { checkDueBacklinks } from '~~/server/utils/backlinks/check'

export default defineMonitoredTask({
  meta: {
    name: 'backlink-check',
    description: 'Re-read sent link requests and verified backlinks; mark won, expired and lost links',
  },
  async run() {
    return { result: await checkDueBacklinks() }
  },
})
