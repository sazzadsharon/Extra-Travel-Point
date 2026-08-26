import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// POST /api/v1/upload (Mock S3 Asset Upload)
router.post('/', authenticateJWT, (req, res) => {
  const mockS3Url = `https://extratravel-assets.s3.ap-southeast-1.amazonaws.com/uploads/img_${Date.now()}.jpg`;
  return res.json({
    message: 'File uploaded to AWS S3 successfully',
    url: mockS3Url
  });
});

export default router;
