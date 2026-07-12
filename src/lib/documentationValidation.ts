import path from 'path'

export const MAX_DOCUMENTATION_FILE_SIZE = Number(
  process.env.DOCUMENTATION_MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024,
)

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
}

export type DocumentationFileValidation =
  | { valid: true; filename: string; mimeType: keyof typeof ALLOWED_FILE_TYPES }
  | { valid: false; reason: 'too_large' | 'invalid_file' }

export const normalizeUploadFilename = (filename: string) =>
  path
    .basename(filename)
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 120)

/** Validates both the browser-provided MIME and a normalized extension. This is
 * a local application control; production deployments still need malware scan. */
export const validateDocumentationFile = ({
  filename,
  mimeType,
  size,
}: {
  filename: string
  mimeType: string
  size: number
}): DocumentationFileValidation => {
  if (!Number.isFinite(size) || size <= 0 || size > MAX_DOCUMENTATION_FILE_SIZE) {
    return { valid: false, reason: size > MAX_DOCUMENTATION_FILE_SIZE ? 'too_large' : 'invalid_file' }
  }

  const normalizedFilename = normalizeUploadFilename(filename)
  const normalizedMime = mimeType.toLowerCase()
  const extension = path.extname(normalizedFilename).toLowerCase()
  const allowedExtensions = ALLOWED_FILE_TYPES[normalizedMime]

  if (!normalizedFilename || !allowedExtensions?.includes(extension)) {
    return { valid: false, reason: 'invalid_file' }
  }

  return { valid: true, filename: normalizedFilename, mimeType: normalizedMime as keyof typeof ALLOWED_FILE_TYPES }
}
