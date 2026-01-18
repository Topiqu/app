import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { RekognitionClient, DetectModerationLabelsCommand, DetectLabelsCommand } from '@aws-sdk/client-rekognition'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const files = await readMultipartFormData(event)

  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const file = files[0]
  if (!file?.type?.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'File must be an image' })
  }

  const credentials = {
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
  }

  const region = config.awsRegion

  const s3 = new S3Client({ region, credentials })
  const rekognition = new RekognitionClient({ region, credentials })

  try {
    const moderationCommand = new DetectModerationLabelsCommand({
      Image: { Bytes: file.data },
      MinConfidence: 75,
    })

    const moderationResult = await rekognition.send(moderationCommand)

    if (moderationResult.ModerationLabels && moderationResult.ModerationLabels.length > 0) {
      const reasons = moderationResult.ModerationLabels.map((l) => l.Name).join(', ')
      throw createError({
        statusCode: 422,
        statusMessage: 'Upload blocked: NSFW content detected',
        data: { reasons },
      })
    }
  } catch (err: any) {
    if (err.statusCode === 422) throw err
    console.error('Rekognition Moderation Error:', err)
  }

  let detectedTagsString = ''
  try {
    const labelsCommand = new DetectLabelsCommand({
      Image: { Bytes: file.data },
      MaxLabels: 10,
      MinConfidence: 80,
    })

    const labelsResult = await rekognition.send(labelsCommand)
    const tags = labelsResult.Labels?.map((l) => l.Name?.replace(/[^a-zA-Z0-9]/g, '')) || []
    detectedTagsString = tags.join(',')
  } catch (err) {
    console.warn('Rekognition Labeling failed:', err)
  }

  const customFilename = files.find((f) => f.name === 'customFilename')?.data.toString()
  const fileExt = file.filename?.split('.').pop() || 'webp'
  const filename = customFilename || `content-${Date.now()}.${fileExt}`
  const optimizedFilename = filename.replace(/\.[^/.]+$/, '.webp')

  const command = new PutObjectCommand({
    Bucket: config.awsS3BucketName,
    Key: `uploads/${filename}`,
    Body: file.data,
    ContentType: file.type,
    Metadata: {
      'rekognition-tags': detectedTagsString,
      'original-name': file.filename ? encodeURIComponent(file.filename) : 'unknown',
    },
  })

  try {
    await s3.send(command)

    return {
      success: true,
      url: `${config.cdnUrl}/uploads/${filename}`,
      optimizedUrl: `${config.cdnUrl}/optimized/${optimizedFilename}`,
      filename,
      tags: detectedTagsString.split(',').filter(Boolean),
    }
  } catch (error) {
    console.error('S3 Upload Error:', error)
    throw createError({ statusCode: 500, statusMessage: 'Upload failed' })
  }
})
