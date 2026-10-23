import type { MediaAsset } from '~~/generated/zenstack/models'

import { z } from 'zod'

import { toDatabaseJson } from './databaseJson'
import { storageKeyFromMediaUrl } from './mediaLibrary'
import { IMAGE_MODERATION_POLICY_VERSION, type ImageAnalysisResult } from './imageAnalysis'

const MODERATION_REUSE_MS = 24 * 60 * 60 * 1000

const moderationProofSchema = z.object({
  uploadModeration: z.object({
    policyVersion: z.literal(IMAGE_MODERATION_POLICY_VERSION),
    moderation: z.literal('clear'),
    checkedAt: z.iso.datetime(),
    sourceHash: z.string().length(64),
    storageKey: z.string().max(512),
  }),
})

const ownedUpload = (asset: MediaAsset, clientSiteId: string, contentHash: string, cdnUrl: string) => {
  if (
    asset.clientSiteId !== clientSiteId ||
    asset.deletedAt ||
    asset.purgedAt ||
    asset.contentHash !== contentHash ||
    asset.mimeType !== 'image/webp' ||
    !asset.storageKey?.startsWith(`uploads/${clientSiteId}/`)
  )
    return false
  if (
    storageKeyFromMediaUrl(asset.url, cdnUrl) !== asset.storageKey ||
    storageKeyFromMediaUrl(asset.deliveryUrl || asset.url, cdnUrl) !== asset.storageKey
  )
    return false
  return true
}

export const canReuseUpload = (asset: MediaAsset, clientSiteId: string, contentHash: string, cdnUrl: string) => {
  if (!ownedUpload(asset, clientSiteId, contentHash, cdnUrl) || asset.archivedAt || asset.purgeAfter) return false
  const parsed = moderationProofSchema.safeParse(asset.metadataSignals)
  if (!parsed.success) return false
  const proof = parsed.data.uploadModeration
  const age = Date.now() - Date.parse(proof.checkedAt)
  return (
    proof.sourceHash === contentHash && proof.storageKey === asset.storageKey && age >= 0 && age < MODERATION_REUSE_MS
  )
}

export const recordUploadModeration = async (
  asset: MediaAsset,
  clientSiteId: string,
  contentHash: string,
  analysis: ImageAnalysisResult,
) => {
  if (!ownedUpload(asset, clientSiteId, contentHash, useRuntimeConfig().public.cdnUrl)) return asset
  const previous =
    asset.metadataSignals && typeof asset.metadataSignals === 'object' && !Array.isArray(asset.metadataSignals)
      ? asset.metadataSignals
      : {}
  const metadataSignals = toDatabaseJson({
    ...previous,
    uploadModeration: {
      policyVersion: IMAGE_MODERATION_POLICY_VERSION,
      moderation: analysis.moderation,
      checkedAt: new Date().toISOString(),
      sourceHash: contentHash,
      storageKey: asset.storageKey,
      modelVersion: analysis.modelVersion,
    },
  })
  try {
    // Only the server writes moderation proof; user-facing reads still use the policy client.
    const saved = await prisma.mediaAsset.updateMany({
      where: {
        id: asset.id,
        clientSiteId,
        contentHash,
        storageKey: asset.storageKey,
        purgedAt: null,
        deletedAt: null,
        updatedAt: asset.updatedAt,
      },
      data: { metadataSignals },
    })
    return saved.count === 1 ? { ...asset, metadataSignals } : asset
  } catch {
    await reportCaughtError('Upload moderation proof not saved', new Error('UPLOAD_MODERATION_PROOF_FAILED'), {
      mediaId: asset.id,
      clientSiteId,
    }).catch(() => {})
    return asset
  }
}
