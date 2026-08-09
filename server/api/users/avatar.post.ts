import { deleteFromCdn, putToCdn } from '~~/server/utils/storage'
import { AVATAR_CONTENT_TYPE, avatarKeyFromUrl, prepareAvatar } from '~~/server/utils/avatar'
import { DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const sessionUser = (await getServerSession(event))?.user
  if (!sessionUser) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file')
  if (!file?.data) throw createError({ statusCode: 400, statusMessage: 'No avatar uploaded' })

  const avatar = await prepareAvatar(file.data)
  const config = useRuntimeConfig()
  const rekognition = new RekognitionClient({
    region: config.awsRegion,
    credentials: { accessKeyId: config.awsAccessKeyId, secretAccessKey: config.awsSecretAccessKey },
  })

  try {
    const moderation = await rekognition.send(
      new DetectModerationLabelsCommand({ Image: { Bytes: avatar }, MinConfidence: 75 }),
    )
    if (moderation.ModerationLabels?.length) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Avatar blocked by content moderation',
        data: { reasons: moderation.ModerationLabels.map((label) => label.Name).filter(Boolean) },
      })
    }
  } catch (error: any) {
    if (error?.statusCode === 422) throw error
    console.error('Avatar moderation failed:', error)
  }

  const current = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { avatarUrl: true } })
  if (!current) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  const key = `avatars/${sessionUser.id}/${crypto.randomUUID()}.webp`
  const url = await putToCdn(key, avatar, AVATAR_CONTENT_TYPE, { 'user-id': sessionUser.id })

  try {
    await saveUserWithLogging(event, { id: sessionUser.id, avatarUrl: url }, true)
  } catch (error) {
    await deleteFromCdn(key, `avatars/${sessionUser.id}/`).catch((cleanupError) =>
      console.error('Avatar rollback failed:', cleanupError),
    )
    throw error
  }

  const oldKey = avatarKeyFromUrl(current.avatarUrl, config.public.cdnUrl)
  if (oldKey && oldKey !== key)
    deleteFromCdn(oldKey, `avatars/${sessionUser.id}/`).catch((error) =>
      console.error('Old avatar cleanup failed:', error),
    )

  return { avatarUrl: url }
})
