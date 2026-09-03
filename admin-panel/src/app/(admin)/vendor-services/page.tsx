'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Ban, RotateCcw, MapPin, Tag, Eye, Package, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-800',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  ARCHIVED: 'bg-gray-200 text-gray-800'
};

interface VendorServiceRow {
  id: number;
  name: string;
  category: string;
  serviceType: string;
  price: number;
  currency?: string;
  lifecycleStatus: string;
  locationCity?: string | null;
  createdAt: string;
  updatedAt: string;
  provider: {
    id: number;
    businessName: string;
    status: string;
    userId: number;
  };
}

export default function VendorServicesPage() {
  const [rows, setRows] = useState<VendorServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ count: number; services: VendorServiceRow[] }>('/api/v1/admin/vendor-services');
      setRows(data.services || []);
    } catch (e) {
      showToast('err', 'Failed to load vendor services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const action = async (id: number, kind: 'suspend' | 'restore' | 'reject') => {
    let reason: string | undefined;
    if (kind === 'reject') {
      reason = window.prompt('Rejection reason (optional):') || undefined;
    }
    setActionId(id);
    try {
      await api(`/api/v1/admin/vendor-services/${id}/${kind}`, {
        method: 'PATCH',
        body: kind === 'reject' ? JSON.stringify({ rejectionReason: reason }) : undefined
      });
      showToast('ok', `Service ${kind}d successfully`);
      await load();
    } catch (e) {
      showToast('err', e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.lifecycleStatus] = (map[r.lifecycleStatus] || 0) + 1;
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.provider.businessName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.lifecycleStatus === statusFilter;
    return matchSearch && matchStatus;
  }), [rows, search, statusFilter]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`px-4 py-2 rounded-lg text-sm border ${toast.kind === 'ok'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-600" /> Vendor Services
          </h2>
          <p className="text-sm text-slate-500">Moderate every service published by vendors across the marketplace.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'ARCHIVED'].map(s => (
          <div key={s} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500">{s.replace('_', ' ')}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{counts[s] || 0}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by service name, category or business…"
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="PUBLISHED">Published</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">Service</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Category</th>
                <th className="p-4">Price</th>
                <th className="p-4">Location</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500">No services match the filters</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">#{r.id} · created {new Date(r.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-slate-700">{r.provider.businessName}</div>
                    <div className="text-xs text-slate-500">vendor #{r.provider.userId}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                      <Tag className="w-3 h-3" /> {r.serviceType}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{r.currency ?? 'BDT'} {Number(r.price).toLocaleString()}</td>
                  <td className="p-4 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> {r.locationCity || '—'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[r.lifecycleStatus] || 'bg-slate-100 text-slate-700'}`}>
                      {r.lifecycleStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.lifecycleStatus !== 'SUSPENDED' && (
                        <button
                          onClick={() => action(r.id, 'suspend')}
                          disabled={actionId === r.id}
                          className="p-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          title="Suspend"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {r.lifecycleStatus === 'SUSPENDED' && (
                        <button
                          onClick={() => action(r.id, 'restore')}
                          disabled={actionId === r.id}
                          className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {r.lifecycleStatus !== 'REJECTED' && (
                        <button
                          onClick={() => action(r.id, 'reject')}
                          disabled={actionId === r.id}
                          className="p-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => action(r.id, 'restore')}
                        disabled={actionId === r.id || r.lifecycleStatus === 'PUBLISHED'}
                        className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        title="Restore to published"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}