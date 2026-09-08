import {
  StorageProvider,
  StorageFile,
  StorageUploadResult,
  StorageProviderConfig,
  generateSafeKey,
  validateFile,
  isAllowedMimeType,
  isAllowedExtension,
} from './storage-provider';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3StorageProvider implements StorageProvider {
  private client: S3Client | null = null;
  private bucket: string;
  private publicBaseUrl: string;
  private maxFileSize: number;
  private configured: boolean;

  constructor(config: StorageProviderConfig) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl || `https://${config.bucket}.s3.${config.region || 'us-east-1'}.amazonaws.com`;
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024;

    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      this.configured = false;
      return;
    }

    this.client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: !!config.endpoint,
    });
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async upload(file: StorageFile, options?: { prefix?: string }): Promise<StorageUploadResult> {
    if (!this.configured || !this.client) {
      throw new Error('Storage provider not configured. Set S3 credentials.');
    }

    const validation = validateFile(file, this.maxFileSize);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const key = generateSafeKey(file.originalName, options?.prefix);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimeType,
    });

    await this.client.send(command);

    return {
      key,
      url: this.getPublicUrl(key),
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    if (!this.configured || !this.client) {
      throw new Error('Storage provider not configured');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}

export class MockStorageProvider implements StorageProvider {
  private store: Map<string, { buffer: Buffer; mimeType: string; size: number }> = new Map();
  private baseUrl: string;
  private configured: boolean = true;

  constructor(baseUrl: string = 'http://localhost:5000/mock-uploads') {
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async upload(file: StorageFile, options?: { prefix?: string }): Promise<StorageUploadResult> {
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const key = generateSafeKey(file.originalName, options?.prefix);
    this.store.set(key, { buffer: file.buffer, mimeType: file.mimeType, size: file.size });

    return {
      key,
      url: this.getPublicUrl(key),
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  clear(): void {
    this.store.clear();
  }
}