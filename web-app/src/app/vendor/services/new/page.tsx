'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { API_CONFIG } from '../../../../config/api';
import type { Vendor, VendorStatus } from '../../../../types/vendor';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default function NewServicePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [provider, setProvider] = useState<Vendor | null>(null);
  const [form, setForm] = useState({
    name: '', category: 'bus', description: '', route: '', price: '', capacity: '', availability: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { default: axios } = await import('axios');
      const res = await axios.get<Vendor>(`${API_CONFIG.API_BASE_URL}/vendors/me`);
      setProvider(res.data);
    } catch {
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  const update = (f: string, v: string) => {
    setForm(prev => ({ ...prev, [f]: v }));
    if (errors[f]) setErrors(prev => ({ ...prev, [f]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Service name is required';
    if (!form.price || parseFloat(form.price) <= 0) e.price = 'Enter a valid price';
    if (Object.keys(e).length) setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate() || !provider) return;
    setIsSubmitting(true);
    try {
      const { default: axios } = await import('axios');
      await axios.post(`${API_CONFIG.API_BASE_URL}/vendors/services`, {
        providerId: provider.id,
        name: form.name,
        category: form.category,
        description: form.description || undefined,
        route: form.route || undefined,
        price: parseFloat(form.price),
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        availability: form.availability || undefined
      });
      setSuccess(true);
      setTimeout(() => router.push('/vendor/services'), 700);
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Failed to create service');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Vendor access required.</p></div>;
  }
  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }
  if (provider?.status !== 'APPROVED') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/vendor" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Only approved vendors can publish services. Your current status: {provider?.status || 'unknown'}.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/services" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Services</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Add New Service</h1>

        {success && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Service created!</div>}
        {apiError && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{apiError}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
              <input className={cls} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Dhaka → Cox's Bazar Bus" />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select className={cls} value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="bus">Bus</option>
                <option value="launch">Launch / Boat</option>
                <option value="flight">Flight</option>
                <option value="hotel">Hotel</option>
                <option value="restaurant">Restaurant</option>
                <option value="tour">Tour / Activity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (BDT) *</label>
              <input className={cls} type="number" value={form.price} onChange={e => update('price', e.target.value)} placeholder="1200" />
              {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input className={cls} type="number" value={form.capacity} onChange={e => update('capacity', e.target.value)} placeholder="40" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
            <input className={cls} value={form.route} onChange={e => update('route', e.target.value)} placeholder="Dhaka → Cox's Bazar" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
            <input className={cls} value={form.availability} onChange={e => update('availability', e.target.value)} placeholder="Daily, 06:00 AM departure" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className={cls} rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Create Service'}
          </button>
        </form>
      </div>
    </div>
  );
}
