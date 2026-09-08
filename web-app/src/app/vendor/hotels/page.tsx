'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Hotel as HotelIcon, Loader2, Plus, Check, X, MapPin, Star, Users, BedDouble, Calendar, DollarSign } from 'lucide-react';
import api from '../../../lib/apiClient';

interface MyHotel {
  id: number;
  businessName: string;
  category: string;
  description?: string | null;
  address: string;
  city?: string | null;
  starRating?: number | null;
  status: string;
  isVerified: boolean;
  isActive: boolean;
  isPublished: boolean;
  lifecycleStatus: string;
  rating: number;
  totalReviews: number;
  rooms: Array<{ id: number; name: string; type: string; price: number; capacity: number; totalRooms: number; isAvailable: boolean }>;
  hotelImages: Array<{ id: number; url: string; isPrimary: boolean }>;
  hotelAmenities: Array<{ id: number; name: string }>;
  hotelPolicy?: any;
}

export default function VendorHotelsPage() {
  const [hotels, setHotels] = useState<MyHotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ businessName: '', address: '', city: '', phone: '', description: '' });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ hotels: MyHotel[] }>('/hotels/manage/mine');
      setHotels(res.data.hotels || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load hotels');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post('/hotels/manage', form);
      setForm({ businessName: '', address: '', city: '', phone: '', description: '' });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create hotel');
    } finally {
      setCreating(false);
    }
  };

  const submitForApproval = async (id: number) => {
    try {
      await api.post(`/hotels/manage/${id}/submit`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit');
    }
  };

  const publishToggle = async (id: number, publish: boolean) => {
    try {
      await api.post(`/hotels/manage/${id}/${publish ? 'publish' : 'unpublish'}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <HotelIcon className="w-6 h-6 text-etp-600" /> My Hotels
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage your property, rooms, pricing and availability.</p>
          </div>
        </div>

        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

        {hotels.length === 0 && !isLoading && (
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Create your hotel</h2>
            <form onSubmit={createHotel} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input required value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} placeholder="Hotel name" className="px-3 py-2 border border-slate-200 rounded-lg" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="px-3 py-2 border border-slate-200 rounded-lg" />
              <input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Address" className="px-3 py-2 border border-slate-200 rounded-lg md:col-span-2" />
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" className="px-3 py-2 border border-slate-200 rounded-lg" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description" className="px-3 py-2 border border-slate-200 rounded-lg md:col-span-2" rows={3} />
              <button disabled={creating} className="md:col-span-2 bg-etp-600 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Hotel (DRAFT)
              </button>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>
        ) : hotels.length > 0 ? (
          <div className="space-y-4">
            {hotels.map(h => (
              <div key={h.id} className="bg-white rounded-2xl shadow-soft border border-slate-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{h.businessName}</h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {h.address} {h.city ? `, ${h.city}` : ''}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">Status: {h.status}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">Lifecycle: {h.lifecycleStatus}</span>
                      {h.isPublished ? <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">Published</span> : <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">Unpublished</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {h.status === 'DRAFT' || h.lifecycleStatus === 'DRAFT' ? (
                      <button onClick={() => submitForApproval(h.id)} className="px-3 py-1.5 text-xs bg-etp-600 text-white rounded-lg font-semibold">Submit for approval</button>
                    ) : null}
                    {h.status === 'APPROVED' && !h.isPublished ? (
                      <button onClick={() => publishToggle(h.id, true)} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-semibold">Publish</button>
                    ) : null}
                    {h.isPublished ? (
                      <button onClick={() => publishToggle(h.id, false)} className="px-3 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-lg font-semibold">Unpublish</button>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <BedDouble className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-bold text-slate-900">{h.rooms.length}</p>
                    <p className="text-[10px] text-slate-500">Room types</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Users className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-bold text-slate-900">{h.rooms.reduce((s, r) => s + r.totalRooms, 0)}</p>
                    <p className="text-[10px] text-slate-500">Total rooms</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Star className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                    <p className="text-lg font-bold text-slate-900">{h.rating > 0 ? h.rating.toFixed(1) : '—'}</p>
                    <p className="text-[10px] text-slate-500">{h.totalReviews} reviews</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <DollarSign className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-bold text-slate-900">BDT {h.rooms[0]?.price?.toLocaleString() || '—'}</p>
                    <p className="text-[10px] text-slate-500">From per night</p>
                  </div>
                </div>
                {h.rooms.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Room types</h3>
                    <div className="space-y-1">
                      {h.rooms.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1 px-2 bg-slate-50 rounded">
                          <span className="text-slate-700">{r.name} <span className="text-xs text-slate-400">({r.type})</span></span>
                          <span className="text-slate-900 font-medium">BDT {r.price.toLocaleString()} · {r.totalRooms} room{r.totalRooms > 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
