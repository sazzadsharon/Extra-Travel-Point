'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Check, X, Ban, RotateCcw, MapPin } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { Vendor, VendorCounts } from '../../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-gray-200 text-gray-800',
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [counts, setCounts] = useState<VendorCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ providers: Vendor[]; counts: VendorCounts[] }>('/api/v1/admin/vendors');
      setVendors(data.providers || []);
      setCounts(data.counts || []);
    } catch (e) {
      showToast('err', 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const action = async (id: number, kind: 'approve' | 'reject' | 'suspend' | 'restore') => {
    const reason = kind === 'reject' ? window.prompt('Rejection reason (optional):') || '' : undefined;
    setActionId(id);
    try {
      await api(`/api/v1/admin/vendors/${id}/${kind}`, {
        method: 'PATCH',
        body: kind === 'reject' ? JSON.stringify({ reason }) : undefined,
      });
      showToast('ok', `Vendor ${kind}d successfully`);
      await load();
    } catch (e) {
      showToast('err', e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const filtered = useMemo(() => vendors.filter(v => {
    const matchSearch = !search ||
      v.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      v.address?.toLowerCase().includes(search.toLowerCase()) ||
      v.user?.phone?.includes(search);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  }), [vendors, search, statusFilter]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`px-4 py-2 rounded-lg text-sm ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Service Providers</h2>
          <p className="text-sm text-slate-500">Approve, reject, suspend or restore vendors</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {counts.map(c => (
          <div key={c.status} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500">{c.status}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{c._count.id}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by business name, address, or phone..."
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">Business</th>
                <th className="p-4">Category</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Commission</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-500">No vendors match</td></tr>
              ) : filtered.map(v => (
                <tr key={v.id} className="border-b hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{v.businessName}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {v.address}</div>
                  </td>
                  <td className="p-4 uppercase text-xs font-bold text-slate-600">{v.category}</td>
                  <td className="p-4">
                    <div className="text-sm">{v.user?.phone || v.phone || '—'}</div>
                    <div className="text-xs text-slate-500">{v.user?.email || v.user?.fullName || ''}</div>
                  </td>
                  <td className="p-4 font-medium">{v.commissionRate}%</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[v.status] || 'bg-slate-100 text-slate-700'}`}>{v.status}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {v.status !== 'APPROVED' && (
                        <button onClick={() => action(v.id, 'approve')} disabled={actionId === v.id} className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Approve">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {v.status !== 'REJECTED' && (
                        <button onClick={() => action(v.id, 'reject')} disabled={actionId === v.id} className="p-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50" title="Reject">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {v.status === 'APPROVED' && (
                        <button onClick={() => action(v.id, 'suspend')} disabled={actionId === v.id} className="p-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50" title="Suspend">
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {(v.status === 'SUSPENDED' || v.status === 'REJECTED') && (
                        <button onClick={() => action(v.id, 'restore')} disabled={actionId === v.id} className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50" title="Restore">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
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
