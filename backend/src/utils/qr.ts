import crypto from 'crypto';
import QRCode from 'qrcode';

const SECRET_KEY = process.env.QR_SECRET_KEY || '';

export interface TravelPassPayload {
  tp: string;
  bkg: string;
  prv: number;
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
  try {
    const expectedSignature = generateHmacSignature(payload);
    const a = Buffer.from(expectedSignature);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateTravelPassToken(): string {
  return crypto.randomBytes(18).toString('hex');
}

export async function createQRCodeDataURL(fullPayload: object): Promise<string> {
  const jsonStr = JSON.stringify(fullPayload);
  return await QRCode.toDataURL(jsonStr);
}