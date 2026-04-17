import prisma from '../../utils/prisma'
import { checkPolicyAndScore } from '../../utils/linkedin/policy'
import { generateContentForTask } from '../../utils/linkedin/generator'
import { publishDecisionAndExecute } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  if (getHeader(event, 'Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const tasks = await prisma.contentTask.findMany({
    where: { status: 'PENDING' },
    include: {
      company: {
        include: {
          brandProfile: true,
          clientSite: { select: { communityInsight: true } },
        },
      },
    },
  })

  for (const task of tasks) {
    try {
      await prisma.contentTask.update({
        where: { id: task.id },
        data: { status: 'GENERATING' },
      })

      const text = await generateContentForTask(
        task.topic,
        task.company.brandProfile,
        task.company.clientSite?.communityInsight,
      )
      const { score, flags } = checkPolicyAndScore(text, task.company.brandProfile)

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
