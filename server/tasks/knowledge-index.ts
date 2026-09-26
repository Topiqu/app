import { drainKnowledgeQueue } from '../utils/knowledge/indexing'

export default defineMonitoredTask({
  meta: {
    name: 'knowledge-index',
    description: 'Chunk and embed PENDING knowledge sources; reclaims runs abandoned mid-index',
  },
  async run() {
    return { result: { ...(await drainKnowledgeQueue()), timestamp: new Date().toISOString() } }
  },
})
