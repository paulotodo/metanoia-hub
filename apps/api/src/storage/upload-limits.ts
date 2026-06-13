/**
 * Upload constraints for wizard media (CHK014 — magic-bytes + size validation).
 *
 * Limits are fail-closed: upload is rejected if any check fails.
 * FR-13: upload failure is non-blocking — the wizard step advances without media.
 */

export const UPLOAD_MAX_SIZE_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOAD_MAX_SIZE_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export const UPLOAD_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
export type UploadAllowedMimeType = (typeof UPLOAD_ALLOWED_MIME_TYPES)[number];

export type UploadMediaType = 'photo' | 'logo';

export const UPLOAD_MAX_SIZE: Record<UploadMediaType, number> = {
  photo: UPLOAD_MAX_SIZE_PHOTO_BYTES,
  logo: UPLOAD_MAX_SIZE_LOGO_BYTES,
};

/**
 * Validates magic-bytes of a buffer against the declared mimeType.
 * Fail-closed: returns false if mimeType is not in the allowlist OR
 * if the magic-bytes do not match.
 *
 * Signatures:
 *   PNG  — bytes[0..3] = 0x89 0x50 0x4E 0x47
 *   JPEG — bytes[0..2] = 0xFF 0xD8 0xFF
 *   WebP — bytes[0..3] = 0x52 0x49 0x46 0x46 ("RIFF") AND
 *           bytes[8..11] = 0x57 0x45 0x42 0x50 ("WEBP")
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/png':
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );

    case 'image/jpeg':
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );

    default:
      // Reject unknown mime types (fail-closed)
      return false;
  }
}

/**
 * Full upload validation: allowlist + size + magic-bytes.
 * Returns null on success or an error message string.
 *
 * @param buffer   Raw file buffer
 * @param mimeType Declared content-type (from multipart header)
 * @param type     'photo' (5 MB) or 'logo' (2 MB)
 */
export function validateUpload(
  buffer: Buffer,
  mimeType: string,
  type: UploadMediaType,
): string | null {
  const allowedMimeSet: readonly string[] = UPLOAD_ALLOWED_MIME_TYPES;
  if (!allowedMimeSet.includes(mimeType)) {
    return `Tipo de arquivo não permitido. Use PNG, JPEG ou WebP.`;
  }

  const maxBytes = UPLOAD_MAX_SIZE[type];
  if (buffer.length > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return `Arquivo excede o tamanho máximo de ${maxMb} MB.`;
  }

  if (!validateMagicBytes(buffer, mimeType)) {
    return `Arquivo corrompido ou tipo incompatível com a extensão declarada.`;
  }

  return null;
}
