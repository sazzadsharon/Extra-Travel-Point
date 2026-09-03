'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import type { Vendor, VendorKyc, KycStatus } from '../../../types/vendor';
import {
  Store,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Save,
  FileText,
  Shield
} from 'lucide-react';

const STATUS_STYLES: Record<KycStatus, string> = {
  NOT_SUBMITTED: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800'
};

const STATUS_ICON: Record<KycStatus, React.ReactNode> = {
  NOT_SUBMITTED: <FileText className="w-4 h-4" />,
  PENDING: <Clock className="w-4 h-4" />,
  APPROVED: <CheckCircle className="w-4 h-4" />,
  REJECTED: <XCircle className="w-4 h-4" />
};

export default function VendorKycPage() {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [kyc, setKyc] = useState<VendorKyc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    businessLegalName: '',
    businessType: '',
    ownerName: '',
    nidNumber: '',
    tradeLicense: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    documentUrl: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [vendorRes, kycRes] = await Promise.all([
        api.get<Vendor>('/vendors/me'),
        api.get<VendorKyc>('/vendors/me/kyc').catch(() => null)
      ]);
      setVendor(vendorRes.data);
      if (kycRes) {
        setKyc(kycRes.data);
        if (kycRes.data.kycData) {
          setForm({
            businessLegalName: kycRes.data.kycData.businessLegalName || '',
            businessType: kycRes.data.kycData.businessType || '',
            ownerName: kycRes.data.kycData.ownerName || '',
            nidNumber: kycRes.data.kycData.nidNumber || '',
            tradeLicense: kycRes.data.kycData.tradeLicense || '',
            address: kycRes.data.kycData.address || '',
            city: kycRes.data.kycData.city || '',
            phone: kycRes.data.kycData.phone || '',
            email: kycRes.data.kycData.email || '',
            documentUrl: kycRes.data.kycData.documentUrl || ''
          });
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load KYC data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'vendor') load();
  }, [user, load]);

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.businessLegalName.trim()) e.businessLegalName = 'Business legal name is required';
    if (!form.businessType.trim()) e.businessType = 'Business type is required';
    if (!form.ownerName.trim()) e.ownerName = 'Owner name is required';
    if (!form.nidNumber.trim()) e.nidNumber = 'NID/Passport number is required';
    else if (form.nidNumber.length < 3 || form.nidNumber.length > 30) e.nidNumber = 'NID must be 3-30 characters';
    if (!form.address.trim()) e.address = 'Address is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (Object.keys(e).length) setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        businessLegalName: form.businessLegalName.trim(),
        businessType: form.businessType.trim(),
        ownerName: form.ownerName.trim(),
        nidNumber: form.nidNumber.trim(),
        tradeLicense: form.tradeLicense.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        documentUrl: form.documentUrl.trim() || undefined
      };

      const res = await api.post('/vendors/me/kyc', payload);
      setSuccess('KYC submitted successfully! Our team will review your documents.');
      setKyc({
        id: vendor?.id || 0,
        businessName: vendor?.businessName || '',
        category: vendor?.category || '',
        kycStatus: 'PENDING',
        kycSubmittedAt: new Date().toISOString(),
        kycReviewedAt: null,
        kycRejectionReason: null,
        kycData: payload,
        user: vendor?.user
      });
      if (vendor) setVendor({ ...vendor, kycStatus: 'PENDING', kycSubmittedAt: new Date().toISOString() });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit KYC');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        businessLegalName: form.businessLegalName.trim(),
        businessType: form.businessType.trim(),
        ownerName: form.ownerName.trim(),
        nidNumber: form.nidNumber.trim(),
        tradeLicense: form.tradeLicense.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        documentUrl: form.documentUrl.trim() || undefined
      };

      const res = await api.patch('/vendors/me/kyc', payload);
      setSuccess('KYC information updated successfully.');
      if (vendor) setVendor({ ...vendor, kycStatus: res.data.kycStatus || vendor.kycStatus });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update KYC');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== 'vendor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vendor Access Required</h2>
          <p className="text-gray-600 mb-4">Please register as a vendor to access KYC.</p>
          <Link href="/vendor/register" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">Register as Vendor</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const kycStatus = vendor?.kycStatus || 'NOT_SUBMITTED';
  const isApproved = kycStatus === 'APPROVED';
  const isPending = kycStatus === 'PENDING';
  const isRejected = kycStatus === 'REJECTED';
  const canEdit = !isApproved;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">KYC Verification</h1>
            <p className="text-gray-500 mt-1">Submit your business verification documents</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${STATUS_STYLES[kycStatus]}`}>
            {STATUS_ICON[kycStatus]} {kycStatus.replace('_', ' ')}
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {(isPending || isApproved) && (
          <div className={`mb-6 px-4 py-3 rounded-lg flex items-start gap-2 ${isApproved ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{isApproved ? 'KYC Approved' : 'KYC Under Review'}</p>
              <p className="text-sm mt-1">
                {isApproved
                  ? 'Your verification has been approved. You can now publish services.'
                  : `Submitted on ${kyc?.kycSubmittedAt ? new Date(kyc.kycSubmittedAt).toLocaleDateString() : 'N/A'}. Our team will review within 2-3 business days.`}
              </p>
              {isRejected && kyc?.kycRejectionReason && (
                <p className="text-sm mt-1 font-medium">Reason: {kyc.kycRejectionReason}</p>
              )}
            </div>
          </div>
        )}

        {isRejected && !canEdit && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">KYC Rejected</p>
              <p className="text-sm mt-1">Reason: {kyc?.kycRejectionReason || 'No reason provided'}</p>
              <p className="text-sm mt-1">Please update your information and resubmit.</p>
            </div>
          </div>
        )}

        <form onSubmit={isApproved ? undefined : (isPending ? undefined : handleSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Legal Name *</label>
                <input
                  type="text"
                  value={form.businessLegalName}
                  onChange={e => update('businessLegalName', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Legal business name"
                />
                {formErrors.businessLegalName && <p className="text-xs text-red-600 mt-1">{formErrors.businessLegalName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type *</label>
                <select
                  value={form.businessType}
                  onChange={e => update('businessType', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Select type</option>
                  <option value="BUS">Bus Transport</option>
                  <option value="HOTEL">Hotel</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="TOUR">Tour / Activity</option>
                  <option value="CAR_RENTAL">Car Rental</option>
                  <option value="BOAT">Boat / Launch</option>
                  <option value="FLIGHT">Flight</option>
                  <option value="OTHER">Other</option>
                </select>
                {formErrors.businessType && <p className="text-xs text-red-600 mt-1">{formErrors.businessType}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={e => update('ownerName', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Full legal name"
                />
                {formErrors.ownerName && <p className="text-xs text-red-600 mt-1">{formErrors.ownerName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NID / Passport / Registration *</label>
                <input
                  type="text"
                  value={form.nidNumber}
                  onChange={e => update('nidNumber', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="NID / Passport / Company Reg. number"
                />
                {formErrors.nidNumber && <p className="text-xs text-red-600 mt-1">{formErrors.nidNumber}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address *</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => update('address', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Full business address"
                />
                {formErrors.address && <p className="text-xs text-red-600 mt-1">{formErrors.address}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City / District</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => update('city', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Dhaka"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="business@example.com"
                />
                {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trade License (optional)</label>
                <input
                  type="text"
                  value={form.tradeLicense}
                  onChange={e => update('tradeLicense', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Trade license number"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Document URL (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.documentUrl}
                    onChange={e => update('documentUrl', e.target.value)}
                    disabled={!canEdit}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="https://example.com/verification-document.pdf"
                  />
                  {canEdit && (
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Provide a link to your verification document (NID, trade license, etc.)</p>
              </div>
            </div>

            {canEdit && (
              <div className="border-t border-gray-200 pt-6">
                <button
                  type={kycStatus === 'NOT_SUBMITTED' ? 'submit' : 'button'}
                  onClick={kycStatus !== 'NOT_SUBMITTED' ? handleUpdate : undefined}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {kycStatus === 'NOT_SUBMITTED' ? 'Submitting...' : 'Updating...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> {kycStatus === 'NOT_SUBMITTED' ? 'Submit KYC' : 'Update KYC'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
