import sharp from 'sharp'

// AUDIT_E2E CNT-04: upload hardening only ever existed in the DocumentationAssets server action
// (src/lib/documentationValidation.ts) - not at the collection boundary, so a direct Payload
// Admin/REST/GraphQL/Local API create bypassed it entirely, and even that action only trusted the
// browser-supplied MIME type string. This module adds a real content check: for anything claiming
// to be an image, the bytes are actually decoded with sharp - a renamed/spoofed non-image file
// fails here regardless of what Content-Type it was uploaded with.
export const MAX_UPLOAD_SIZE_BYTES = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024)

export type UploadValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export const validateUploadSize = (size: number | undefined): UploadValidationResult => {
  if (!size || !Number.isFinite(size) || size <= 0) {
    return { valid: false, reason: 'The uploaded file is empty or unreadable.' }
  }
  if (size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      reason: `File is larger than the ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB limit.`,
    }
  }
  return { valid: true }
}

/** Decodes the actual bytes with sharp - throws (and we report `valid: false`) if the file isn't
 * really a decodable raster image, regardless of its declared filename/Content-Type. Only call
 * this for uploads that are supposed to be images; video/PDF have their own container formats and
 * sharp can't validate those. */
export const validateImageBuffer = async (buffer: Buffer): Promise<UploadValidationResult> => {
  try {
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height) {
      return { valid: false, reason: 'File could not be read as a valid image.' }
    }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'File could not be read as a valid image.' }
  }
}

/** Magic-byte checks for the two non-image types DocumentationAssets accepts - lightweight (no new
 * dependency), but still real content sniffing rather than trusting the declared Content-Type. */
export const validatePdfBuffer = (buffer: Buffer): UploadValidationResult =>
  buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    ? { valid: true }
    : { valid: false, reason: 'File could not be read as a valid PDF.' }

export const validateMp4Buffer = (buffer: Buffer): UploadValidationResult =>
  buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    ? { valid: true }
    : { valid: false, reason: 'File could not be read as a valid MP4 video.' }
