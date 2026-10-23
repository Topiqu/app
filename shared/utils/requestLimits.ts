import {
  AVATAR_MAX_UPLOAD_BYTES,
  EMOJI_MAX_UPLOAD_BYTES,
  FONT_MAX_UPLOAD_BYTES,
  IMAGE_MAX_UPLOAD_BYTES,
} from './uploadLimits'

export const REQUEST_BODY_MAX_BYTES = 2_000_000

// Allow the largest supported file plus multipart fields/boundaries. Every upload
// route still enforces its specialized file limit after parsing.
export const MULTIPART_BODY_MAX_BYTES =
  Math.max(AVATAR_MAX_UPLOAD_BYTES, EMOJI_MAX_UPLOAD_BYTES, FONT_MAX_UPLOAD_BYTES, IMAGE_MAX_UPLOAD_BYTES) + 1024 * 1024
