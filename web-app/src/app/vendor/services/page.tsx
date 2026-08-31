'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { API_CONFIG } from '../../../config/api';
import { Package, Plus, Pencil, Loader2, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react';
import type { Service } from '../../../types/vendor';

export default function VendorServicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { default: axios } = await import('axios');
      const res = await axios.get<Service[]>(`${API_CONFIG.API_BASE_URL}/vendors/services`);
      setServices(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load services');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  const deactivate = async (id: number) => {
    if (!confirm('Deactivate this service? It will no longer be bookable.')) return;
    setActionId(id);
    try {
      const { default: axios } = await import('axios');
      await axios.delete(`${API_CONFIG.API_BASE_URL}/vendors/services/${id}`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to deactivate');
    } finally {
      setActionId(null);
    }
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Vendor access required.</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Services</h1>
          <Link href="/vendor/services/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Service
          </Link>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{error}</div>}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No services yet</h3>
            <p className="text-gray-500 mb-4">Add your first transport, hotel, or activity service.</p>
            <Link href="/vendor/services/new" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Service
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{s.category}{s.route ? ` · ${s.route}` : ''}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-blue-700">BDT {s.price}{s.capacity ? ` · Cap ${s.capacity}` : ''}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => router.push(`/vendor/services/${s.id}`)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => deactivate(s.id)} disabled={actionId === s.id} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                    <Trash2 className="w-3 h-3" /> Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
