import { StorageProvider, StorageProviderConfig } from './storage-provider';
import { S3StorageProvider, MockStorageProvider } from './s3-storage-provider';

let storageProviderInstance: StorageProvider | null = null;

export function getStorageProvider(config?: StorageProviderConfig): StorageProvider {
  if (storageProviderInstance) {
    return storageProviderInstance;
  }

  const providerType = config?.provider || process.env.STORAGE_PROVIDER || 'mock';

  if (providerType === 's3') {
    const s3Config: StorageProviderConfig = {
      provider: 's3',
      bucket: config?.bucket || process.env.S3_BUCKET || '',
      region: config?.region || process.env.S3_REGION,
      endpoint: config?.endpoint || process.env.S3_ENDPOINT,
      accessKeyId: config?.accessKeyId || process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: config?.publicBaseUrl || process.env.S3_PUBLIC_BASE_URL,
      maxFileSize: config?.maxFileSize || parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '10485760'),
    };

    const instance = new S3StorageProvider(s3Config);
    if (!instance.isConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('S3 storage provider selected but not properly configured. Check S3_* environment variables.');
      }
      console.warn('S3 storage not configured, falling back to mock provider');
      storageProviderInstance = new MockStorageProvider(process.env.S3_PUBLIC_BASE_URL);
    } else {
      storageProviderInstance = instance;
    }
  } else {
    storageProviderInstance = new MockStorageProvider(process.env.S3_PUBLIC_BASE_URL);
  }

  return storageProviderInstance;
}

export function resetStorageProvider(): void {
  storageProviderInstance = null;
}

export function setStorageProviderForTesting(provider: StorageProvider): void {
  storageProviderInstance = provider;
}