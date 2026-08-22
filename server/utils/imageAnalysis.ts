import { DetectLabelsCommand, DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition'

export async function analyzeImage(image: Uint8Array) {
  const config = useRuntimeConfig()
  const client = new RekognitionClient({
    region: config.awsRegion,
    credentials: { accessKeyId: config.awsAccessKeyId, secretAccessKey: config.awsSecretAccessKey },
  })

  try {
    const result = await client.send(new DetectModerationLabelsCommand({ Image: { Bytes: image }, MinConfidence: 75 }))
    if (result.ModerationLabels?.length) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Upload blocked: NSFW content detected',
        data: { reasons: result.ModerationLabels.map((label) => label.Name).filter(Boolean) },
      })
    }
  } catch (error: any) {
    if (error?.statusCode === 422) throw error
    console.error('Rekognition moderation failed:', error)
  }

  try {
    const result = await client.send(
      new DetectLabelsCommand({ Image: { Bytes: image }, MaxLabels: 10, MinConfidence: 80 }),
    )
    return result.Labels?.map((label) => label.Name?.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean) || []
  } catch (error) {
    console.warn('Rekognition labeling failed:', error)
    return []
  }
}
