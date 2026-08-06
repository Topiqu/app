import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const putToCdn = async (
  key: string,
  body: Uint8Array,
  contentType: string,
  metadata?: Record<string, string>,
) => {
  const config = useRuntimeConfig()

  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: config.awsS3BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }),
  )

  return `${config.public.cdnUrl}/${key}`
}
