export interface StorageFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StorageUploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface StorageProviderConfig {
  provider: 's3' | 'mock';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  maxFileSize?: number;
}

export interface StorageProvider {
  upload(file: StorageFile, options?: { prefix?: string }): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  isConfigured(): boolean;
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'pdf',
] as const;

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType as any);
}

export function isAllowedExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ALLOWED_EXTENSIONS.includes(ext as any) : false;
}

export function generateSafeKey(originalName: string, prefix?: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const safeExt = ALLOWED_EXTENSIONS.includes(ext as any) ? ext : 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const prefixPart = prefix ? `${prefix}/` : '';
  return `${prefixPart}${timestamp}-${random}.${safeExt}`;
}

export function validateFile(file: StorageFile, maxSize?: number): { valid: boolean; error?: string } {
  if (!file.buffer || file.buffer.length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  if (!isAllowedMimeType(file.mimeType)) {
    return { valid: false, error: `Disallowed MIME type: ${file.mimeType}` };
  }

  if (!isAllowedExtension(file.originalName)) {
    return { valid: false, error: `Disallowed file extension` };
  }

  const limit = maxSize || 10 * 1024 * 1024;
  if (file.size > limit) {
    return { valid: false, error: `File size ${file.size} exceeds limit ${limit}` };
  }

  return { valid: true };
}