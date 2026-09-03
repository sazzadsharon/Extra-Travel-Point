'use client';

import { useState, useCallback } from 'react';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { QrCode, CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react';

interface VerifyResult {
  valid: boolean;
  bookingCode?: string;
  user_name?: string;
  category?: string;
  validFrom?: string;
  validUntil?: string;
  error?: string;
}

export default function VendorScannerPage() {
  const { user } = useAuth();
  const [qrPayload, setQrPayload] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const verifyOnBackend = useCallback(async () => {
    if (!qrPayload.trim()) return;
    setIsVerifying(true);
    setResult(null);
    try {
      // The QR payload is the JSON string the scanner reads from the image.
      let parsed: unknown = qrPayload;
      try { parsed = JSON.parse(qrPayload); } catch { /* keep as string */ }
      const res = await api.post(`/travel-passes/verify`, { qrData: parsed });
      setResult(res.data);
    } catch (err: any) {
      setResult({ valid: false, error: err.response?.data?.error || err.message || 'Verification failed' });
    } finally {
      setIsVerifying(false);
    }
  }, [qrPayload]);

  if (user?.role !== 'vendor' && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vendor / Admin only</h2>
          <p className="text-gray-600">Only vendors and administrators can verify travel passes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <QrCode className="w-6 h-6 text-blue-600" /> Travel Pass Scanner
        </h1>
        <p className="text-gray-600 mb-6">
          Paste the QR payload (or scan it into the box) to verify a customer&apos;s Travel Pass.
          The backend is always the source of truth — never trust a QR shown on the device alone.
        </p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">QR Payload</span>
            <textarea
              rows={5}
              value={qrPayload}
              onChange={(e) => setQrPayload(e.target.value)}
              placeholder='{"payload": {...}, "signature": "..."}'
              className="mt-1 w-full border border-gray-300 rounded-lg p-3 font-mono text-xs"
            />
          </label>
          <button
            onClick={verifyOnBackend}
            disabled={isVerifying || !qrPayload.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Verify
          </button>
        </div>

        {result && (
          <div className={`mt-6 rounded-xl border p-6 ${result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {result.valid ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-lg font-bold text-green-900">Valid Travel Pass</h2>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-green-700">Booking</dt><dd className="font-medium text-green-900">{result.bookingCode}</dd></div>
                  <div><dt className="text-green-700">Customer</dt><dd className="font-medium text-green-900">{result.user_name}</dd></div>
                  <div><dt className="text-green-700">Category</dt><dd className="font-medium text-green-900">{result.category}</dd></div>
                  <div><dt className="text-green-700">Valid Until</dt><dd className="font-medium text-green-900">{result.validUntil}</dd></div>
                </dl>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="w-6 h-6 text-red-600" />
                <h2 className="text-lg font-bold text-red-900">Invalid: {result.error}</h2>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}