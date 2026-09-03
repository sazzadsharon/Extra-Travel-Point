'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '../../lib/apiClient';
import { Loader2, MapPin, Tag, Search, Package, Sparkles } from 'lucide-react';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, type ServiceLifecycleStatus } from '../../types/vendor';

interface DiscoverService {
  id: number;
  name: string;
  serviceType: string;
  lifecycleStatus: ServiceLifecycleStatus;
  description?: string | null;
  route?: string | null;
  price: number;
  currency?: string;
  capacity?: number | null;
  locationCity?: string | null;
  locationAddress?: string | null;
  images?: string | null;
  provider: {
    id: number;
    businessName: string;
    city?: string | null;
    rating?: number;
    totalReviews?: number;
    logo?: string | null;
  };
}

export default function ServicesDiscoveryPage() {
  const [services, setServices] = useState<DiscoverService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [q, setQ] = useState<string>('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (serviceType) params.append('serviceType', serviceType);
      if (city) params.append('city', city);
      if (q) params.append('q', q);
      const qs = params.toString();
      const url = `/vendor-services/discover${qs ? `?${qs}` : ''}`;
      const res = await api.get<{ count: number; services: DiscoverService[] }>(url);
      setServices(res.data.services);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load services');
    } finally {
      setIsLoading(false);
    }
  }, [serviceType, city, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-etp-100 text-etp-700 px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Discover Services
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Find your next journey</h1>
          <p className="text-slate-500 max-w-xl mx-auto">Browse hotels, tours, transport, activities and more from verified ETP vendors.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-4 sm:p-5 mb-8 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, route or description…"
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-etp-500 focus:border-etp-500"
            />
          </div>
          <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white">
            <option value="">All categories</option>
            {SERVICE_TYPES.map((t: typeof SERVICE_TYPES[number]) => (
              <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="City"
            className="px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-etp-500 focus:border-etp-500"
          />
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-etp-50 mb-4">
              <Package className="w-8 h-8 text-etp-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No services match your filters</h3>
            <p className="text-slate-500">Try removing some filters or check back soon — new services are added regularly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-soft border border-slate-100 p-5 hover:shadow-lift transition-all">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-slate-900 text-lg">{s.name}</h3>
                  <span className="px-2 py-1 rounded-md bg-etp-50 text-etp-700 text-xs font-medium border border-etp-100">
                    {s.serviceType?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3 line-clamp-3 min-h-[3.6em]">
                  {s.description || s.route || '—'}
                </p>
                <div className="flex items-center justify-between text-sm mb-3">
                  <div className="font-bold text-slate-900">
                    {s.currency ?? 'BDT'} {Number(s.price).toLocaleString()}
                    {s.capacity ? <span className="text-xs text-slate-500 font-normal ml-1">/ {s.capacity} pax</span> : null}
                  </div>
                  {s.provider?.rating ? (
                    <div className="text-xs text-amber-600 font-medium">★ {s.provider.rating.toFixed(1)}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                  <MapPin className="w-3 h-3" /> {s.locationCity ?? s.provider?.city ?? '—'}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {s.provider?.businessName}
                  </span>
                </div>
                <Link
                  href={`/services/${s.id}`}
                  className="block w-full text-center bg-gradient-to-r from-etp-600 to-violet-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:from-etp-700 hover:to-violet-700"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}