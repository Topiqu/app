import { measureContentActions, processQueuedActions } from '~~/server/utils/keywords/refresh'

export default defineMonitoredTask({
  meta: {
    name: 'content-actions',
    description: 'Prepare article updates the editor asked for; each holds a reserved article credit',
  },
  async run() {
    const prepared = await processQueuedActions()
    return { result: { ...prepared, measurement: await measureContentActions() } }
  },
})
