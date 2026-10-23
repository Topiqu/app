import { DetectLabelsCommand, DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition'

export const IMAGE_MODERATION_POLICY_VERSION = 1

export type ImageAnalysisResult = {
  tags: string[]
  moderation: 'clear' | 'unavailable'
  modelVersion?: string
}

export async function analyzeImage(image: Uint8Array): Promise<ImageAnalysisResult> {
  const config = useRuntimeConfig()
  const client = new RekognitionClient({
    region: config.awsRegion,
    maxAttempts: 2,
    credentials: { accessKeyId: config.awsAccessKeyId, secretAccessKey: config.awsSecretAccessKey },
  })

  let moderation: ImageAnalysisResult['moderation'] = 'unavailable'
  let modelVersion: string | undefined
  try {
    try {
      const result = await client.send(
        new DetectModerationLabelsCommand({ Image: { Bytes: image }, MinConfidence: 75 }),
        { abortSignal: AbortSignal.timeout(8000) },
      )
      if (result.ModerationLabels?.length) {
        throw createError({
          statusCode: 422,
          statusMessage: 'Upload blocked: NSFW content detected',
          data: { reasons: result.ModerationLabels.map((label) => label.Name).filter(Boolean) },
        })
      }
      moderation = 'clear'
      modelVersion = result.ModerationModelVersion
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 422) throw error
      await reportCaughtError('Image moderation unavailable', new Error('IMAGE_MODERATION_UNAVAILABLE')).catch(() => {})
    }

    try {
      const result = await client.send(
        new DetectLabelsCommand({ Image: { Bytes: image }, MaxLabels: 10, MinConfidence: 80 }),
        { abortSignal: AbortSignal.timeout(8000) },
      )
      return {
        moderation,
        modelVersion,
        tags:
          result.Labels?.map((label) => label.Name?.replace(/[^a-zA-Z0-9]/g, '')).filter((tag): tag is string =>
            Boolean(tag),
          ) || [],
      }
    } catch {
      await reportCaughtError('Image labeling unavailable', new Error('IMAGE_LABELING_UNAVAILABLE')).catch(() => {})
      return { tags: [], moderation, modelVersion }
    }
  } finally {
    client.destroy()
  }
}
