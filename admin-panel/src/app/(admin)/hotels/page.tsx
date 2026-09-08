'use client';

import React, { useEffect, useState } from 'react';
import { Hotel as HotelIcon, Check, X, Ban, RefreshCw, Search, MapPin, Star } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';

interface AdminHotel {
  id: number;
  businessName: string;
  category: string;
  status: string;
  isVerified: boolean;
  isActive: boolean;
  isPublished: boolean;
  lifecycleStatus: string;
  city?: string | null;
  address: string;
  starRating?: number | null;
  rating: number;
  totalReviews: number;
  user?: { fullName?: string; phone?: string };
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-gray-200 text-gray-800',
  DRAFT: 'bg-slate-100 text-slate-700',
  INACTIVE: 'bg-slate-100 text-slate-700',
};

export default function AdminHotelsPage() {
  const [hotels, setHotels] = useState<AdminHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('lifecycleStatus', statusFilter);
      const data = await api<{ hotels: AdminHotel[]; total: number }>(`/api/v1/hotels/admin/list?${qs.toString()}`);
      setHotels((data as any).hotels || []);
    } catch (e) {
      showToast('err', 'Failed to load hotels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const action = async (id: number, kind: 'approve' | 'reject' | 'suspend') => {
    const reason = kind === 'reject' ? window.prompt('Reason (optional):') || '' : undefined;
    setActionId(id);
    try {
      await api(`/api/v1/hotels/admin/${id}/${kind}`, {
        method: 'POST',
        body: reason ? JSON.stringify({ reason }) : undefined,
      });
      showToast('ok', `Hotel ${kind}${kind === 'approve' ? 'd' : kind === 'reject' ? 'ed' : 'ed'} successfully`);
      await load();
    } catch (e) {
      showToast('err', e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const filtered = hotels.filter(h => {
    const matchSearch = !search || h.businessName.toLowerCase().includes(search.toLowerCase()) || (h.city || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || h.status === statusFilter || h.lifecycleStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HotelIcon className="w-6 h-6 text-etp-600" />
            Hotel Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Approve, reject, and oversee hotel providers across the platform.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {toast && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or city…"
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="all">All status</option>
          <option value="PENDING">Pending</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <HotelIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p>No hotels found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Hotel</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Location</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Rating</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Published</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{h.businessName}</div>
                      <div className="text-xs text-slate-500">{h.user?.fullName || h.user?.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {h.city || h.address?.slice(0, 30)}
                      </div>
                      {h.starRating ? (
                        <div className="flex items-center gap-0.5 mt-1 text-amber-500">
                          {Array.from({ length: h.starRating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[h.status] || 'bg-slate-100 text-slate-700'}`}>
                        {h.status}
                      </span>
                      {h.lifecycleStatus && h.lifecycleStatus !== h.status ? (
                        <div className="text-[10px] text-slate-400 mt-1">{h.lifecycleStatus}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {h.rating > 0 ? `★ ${h.rating.toFixed(1)} (${h.totalReviews})` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {h.isPublished ? (
                        <span className="text-emerald-600 text-xs font-medium">Live</span>
                      ) : (
                        <span className="text-slate-400 text-xs">Hidden</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {h.status !== 'APPROVED' && (
                          <button
                            onClick={() => action(h.id, 'approve')}
                            disabled={actionId === h.id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {h.status !== 'REJECTED' && (
                          <button
                            onClick={() => action(h.id, 'reject')}
                            disabled={actionId === h.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {h.status === 'APPROVED' && (
                          <button
                            onClick={() => action(h.id, 'suspend')}
                            disabled={actionId === h.id}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded disabled:opacity-50"
                            title="Suspend"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-3">Showing {filtered.length} of {hotels.length} hotels</p>
    </div>
  );
}
