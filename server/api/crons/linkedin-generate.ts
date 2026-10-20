import prisma from '../../utils/prisma'
import { checkPolicyAndScore } from '../../utils/linkedin/policy'
import { generateContentForTask } from '../../utils/linkedin/generator'
import { publishDecisionAndExecute } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  requireCron(event)

  const tasks = await prisma.contentTask.findMany({
    where: { status: 'PENDING', company: { clientSite: { publishToLinkedIn: true } } },
    include: {
      company: {
        include: {
          clientSite: { select: { communityInsight: true, aiToneOfVoice: true, audience: true } },
        },
      },
    },
  })

  for (const task of tasks) {
    try {
      const claimed = await prisma.contentTask.updateMany({
        where: { id: task.id, status: 'PENDING' },
        data: { status: 'GENERATING' },
      })
      if (!claimed.count) continue

      const { communityInsight, aiToneOfVoice, audience } = task.company.clientSite
      const text = await generateContentForTask(task.topic, { tone: aiToneOfVoice, audience }, communityInsight)
      const { score, flags } = checkPolicyAndScore(text)

      const draft = await prisma.draftPost.create({
        data: {
          taskId: task.id,
          text,
          score,
          policyFlags: flags,
          status: 'DRAFT',
        },
      })

      await prisma.contentTask.update({
        where: { id: task.id },
        data: { status: 'COMPLETED' },
      })

      await publishDecisionAndExecute(draft.id)
    } catch (err) {
      console.error(`Failed to generate draft for task ${task.id}`, err)
      await prisma.contentTask.update({
        where: { id: task.id },
        data: { status: 'FAILED' },
      })
    }
  }

  return { success: true, count: tasks.length }
})
