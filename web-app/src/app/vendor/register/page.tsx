'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Bus, Store, Loader2, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  { value: 'bus', label: 'Bus Transport' },
  { value: 'launch', label: 'Launch / Boat' },
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'tour', label: 'Tour / Activity' },
  { value: 'food', label: 'Food' },
];

export default function VendorRegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [form, setForm] = useState({
    businessName: '',
    category: 'bus',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    address: '',
    city: '',
    description: '',
    phoneBusiness: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.businessName.trim()) e.businessName = 'Business name is required';
    if (!form.ownerName.trim()) e.ownerName = 'Owner name is required';
    if (!/^01[3-9]\d{8}$/.test(form.phone)) e.phone = 'Enter a valid BD phone (01X-XXXXXXXX)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!form.address.trim()) e.address = 'Business address is required';
    if (Object.keys(e).length) setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/vendors/register`, form);
      const { user, tokens } = res.data;
      setSession(user, tokens.accessToken, tokens.refreshToken);
      setSuccess(true);
      setTimeout(() => router.push('/vendor'), 800);
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/business" className="text-blue-600 hover:text-blue-800 text-sm mb-6 inline-block">
          ← Back to Business
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Become an ETP Vendor</h1>
              <p className="text-gray-500 text-sm">List your travel business and reach more customers</p>
            </div>
          </div>

          {success && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Vendor registered! Redirecting to your dashboard…
            </div>
          )}

          {apiError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Business Name *" error={errors.businessName}>
                <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="Green Line Paribahan" />
              </Field>
              <Field label="Business Category *" error={errors.category}>
                <select               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.category} onChange={e => update('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Owner / Contact Name *" error={errors.ownerName}>
                <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.ownerName} onChange={e => update('ownerName', e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Login Phone *" error={errors.phone}>
                <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="01XXXXXXXXX" />
              </Field>
              <Field label="Email" error={errors.email}>
                <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="business@example.com" />
              </Field>
              <Field label="Password *" error={errors.password}>
                <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 6 characters" />
              </Field>
            </div>

            <Field label="Business Address *" error={errors.address}>
              <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Street, Area" />
            </Field>

            <Field label="City">
              <input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Dhaka" />
            </Field>

            <Field label="Business Description">
              <textarea               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={3} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Short description of your services" />
            </Field>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Bus className="w-5 h-5" /> Register as Vendor</>}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Your account will be created as <span className="font-medium">PENDING</span>. Our team will review and approve it before you can publish services.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
