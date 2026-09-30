import { refreshKnowledgeSources } from '../utils/knowledge/refresh'

export default defineMonitoredTask({
  meta: {
    name: 'knowledge-refresh',
    description: 'Re-fetch week-old URL knowledge, queue day-old feeds, requeue sources embedded by a retired model',
  },
  async run() {
    return { result: { ...(await refreshKnowledgeSources()), timestamp: new Date().toISOString() } }
  },
})
