import { Router, Request } from 'express';
import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { getStorageProvider } from '../utils/storage-factory';
import { validateFile, isAllowedMimeType } from '../utils/storage-provider';
import { logWarn } from '../utils/logger';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '10485760'),
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!isAllowedMimeType(file.mimetype)) {
      return cb(new Error(`Disallowed MIME type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

router.post('/', authenticateJWT, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!('buffer' in req.file)) {
      return res.status(400).json({ error: 'Uploaded file buffer is unavailable' });
    }

    const provider = getStorageProvider();
    if (!provider.isConfigured()) {
      logWarn('Upload rejected: storage provider not configured', { userId: req.user?.id });
      return res.status(500).json({ error: 'Storage is not configured on the server' });
    }

    const file = {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    };

    const validation = validateFile(file, parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '10485760'));
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const prefix = process.env.STORAGE_UPLOAD_PREFIX || 'uploads';
    const result = await provider.upload(file, { prefix });

    return res.status(201).json({
      message: 'File uploaded successfully',
      url: result.url,
      key: result.key,
      size: result.size,
      mimeType: result.mimeType,
    });
  } catch (err: any) {
    logWarn('Upload failed', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
