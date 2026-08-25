import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const getS3 = () => {
  const config = useRuntimeConfig()
  return {
    bucket: config.awsS3BucketName,
    client: new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    }),
  }
}

export const putToCdn = async (
  key: string,
  body: Uint8Array,
  contentType: string,
  metadata?: Record<string, string>,
  options?: { cacheControl?: string },
) => {
  const config = useRuntimeConfig()

  const { bucket, client } = getS3()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
      CacheControl: options?.cacheControl,
    }),
  )

  return `${config.public.cdnUrl}/${key}`
}

export const deleteFromCdn = async (key: string, allowedPrefix: string) => {
  if (!allowedPrefix || !key.startsWith(allowedPrefix))
    throw new Error(`Refusing to delete CDN object outside ${allowedPrefix}`)
  const { bucket, client } = getS3()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
