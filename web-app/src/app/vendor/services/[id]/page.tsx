'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { API_CONFIG } from '../../../../config/api';
import { Loader2, ArrowLeft, CheckCircle, Save } from 'lucide-react';
import type { Service } from '../../../../types/vendor';

const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default function EditServicePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const serviceId = params.id as string;

  const [service, setService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '', category: '', description: '', route: '', price: '', capacity: '', availability: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { default: axios } = await import('axios');
      const res = await axios.get<Service>(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}`);
      setService(res.data);
      setForm({
        name: res.data.name,
        category: res.data.category,
        description: res.data.description || '',
        route: res.data.route || '',
        price: String(res.data.price),
        capacity: res.data.capacity ? String(res.data.capacity) : '',
        availability: res.data.availability || '',
        status: res.data.status
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load service');
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  const update = (f: string, v: string) => {
    setForm(prev => ({ ...prev, [f]: v }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const { default: axios } = await import('axios');
      await axios.patch(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}`, {
        name: form.name,
        category: form.category,
        description: form.description || undefined,
        route: form.route || undefined,
        price: parseFloat(form.price),
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        availability: form.availability || undefined,
        status: form.status
      });
      setSaved(true);
      setTimeout(() => router.push('/vendor/services'), 700);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update service');
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Vendor access required.</p></div>;
  }
  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }
  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/vendor/services" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">{error || 'Service not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/services" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Services</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Service</h1>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {saved && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Saved</div>}

        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
              <input className={cls} value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input className={cls} value={form.category} onChange={e => update('category', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (BDT)</label>
              <input className={cls} type="number" value={form.price} onChange={e => update('price', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input className={cls} type="number" value={form.capacity} onChange={e => update('capacity', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
            <input className={cls} value={form.route} onChange={e => update('route', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
            <input className={cls} value={form.availability} onChange={e => update('availability', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className={cls} rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className={cls} value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <button type="submit" disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </form>
      </div>
    </div>
  );
}
