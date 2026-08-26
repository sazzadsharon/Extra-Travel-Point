import crypto from 'crypto';
import QRCode from 'qrcode';

const SECRET_KEY = process.env.QR_SECRET_KEY || 'extratravel_qr_hmac_secret_key_2026';

export interface QRPayload {
  booking_id: string;
  user_id: string;
  provider_id: string;
  category: string;
  valid_from: string;
  valid_until: string;
  discounts: Array<{
    type: string;
    provider: string;
    value: number;
    unit: string;
  }>;
}

export function generateHmacSignature(payload: object): string {
  const dataString = JSON.stringify(payload);
  return crypto.createHmac('sha256', SECRET_KEY).update(dataString).digest('hex');
}

export function verifyHmacSignature(payload: object, signature: string): boolean {
  const expectedSignature = generateHmacSignature(payload);
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
}

export async function createQRCodeDataURL(fullPayload: object): Promise<string> {
  const jsonStr = JSON.stringify(fullPayload);
  return await QRCode.toDataURL(jsonStr);
}
