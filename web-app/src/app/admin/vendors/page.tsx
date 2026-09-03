'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Loader2, CheckCircle, XCircle, AlertCircle, Store, ShieldX, RotateCcw, ChevronDown } from 'lucide-react';
import type { Vendor, VendorStatus } from '../../../types/vendor';

const STATUS_TABS: { key: VendorStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Suspended' }
];

const STATUS_STYLES: Record<VendorStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-gray-100 text-gray-800'
};

export default function AdminVendorsPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<VendorStatus | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Vendor | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (tab !== 'ALL') params.status = tab;
      const res = await api.get<{ providers: Vendor[]; counts: { status: string; _count: { id: number } }[] }>(
        `/admin/vendors`, { params }
      );
      setVendors(res.data.providers);
      const c: Record<string, number> = {};
      res.data.counts.forEach(x => { c[x.status] = x._count.id; });
      setCounts(c);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load vendors');
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

  const act = async (id: number, action: 'approve' | 'reject' | 'suspend' | 'restore', reason?: string) => {
    setActionId(id);
    try {
      await api.patch(`/admin/vendors/${id}/${action}`, action === 'reject' ? { reason } : {});
      setDetail(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const openDetail = async (id: number) => {
    try {
      const res = await api.get<Vendor>(`/admin/vendors/${id}`);
      setDetail(res.data);
      setRejectReason('');
    } catch {
      /* ignore */
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShieldX className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendor Management</h1>
        <p className="text-gray-500 mb-6">Review, approve, and manage business partners.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{error}</div>}

        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>
              {t.label} {t.key !== 'ALL' && counts[t.key] ? `(${counts[t.key]})` : ''}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : vendors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">No vendors in this category.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map(v => (
              <div key={v.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900">{v.businessName}</p>
                      <p className="text-sm text-gray-500 capitalize">{v.category} · {v.city || '—'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[v.status]}`}>{v.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">Owner: {v.user?.fullName || 'N/A'} · {v.user?.phone || ''}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openDetail(v.id)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">Details</button>
                  {v.status === 'PENDING' && (
                    <button onClick={() => act(v.id, 'approve')} disabled={actionId === v.id} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                  )}
                  {v.status === 'APPROVED' && (
                    <button onClick={() => act(v.id, 'suspend')} disabled={actionId === v.id} className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <ShieldX className="w-3 h-3" /> Suspend
                    </button>
                  )}
                  {v.status === 'SUSPENDED' || v.status === 'REJECTED' ? (
                    <button onClick={() => act(v.id, 'restore')} disabled={actionId === v.id} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  ) : (
                    <button onClick={() => act(v.id, 'reject', rejectReason)} disabled={actionId === v.id} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  )}
                </div>
                {v.status === 'REJECTED' && v.rejectionReason && (
                  <p className="text-xs text-red-600 mt-2">Reason: {v.rejectionReason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {detail && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDetail(null)}>
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{detail.businessName}</h2>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <Field label="Status" value={detail.status.replace('_', ' ')} />
                <Field label="Category" value={detail.category} />
                <Field label="City" value={detail.city || '—'} />
                <Field label="Phone" value={detail.phone || '—'} />
                <Field label="Commission" value={`${detail.commissionRate}%`} />
                <Field label="Verified" value={detail.isVerified ? 'Yes' : 'No'} />
              </div>
              <p className="text-sm text-gray-600 mb-4">{detail.description || 'No description.'}</p>

              {detail.status === 'PENDING' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (if rejecting)</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {detail.status === 'PENDING' && (
                  <button onClick={() => act(detail.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Approve</button>
                )}
                <button onClick={() => act(detail.id, 'reject', rejectReason)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Reject</button>
                {detail.status === 'APPROVED' && (
                  <button onClick={() => act(detail.id, 'suspend')} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Suspend</button>
                )}
                {(detail.status === 'SUSPENDED' || detail.status === 'REJECTED') && (
                  <button onClick={() => act(detail.id, 'restore')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Restore</button>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Services ({detail.services?.length ?? 0})</h3>
                {!detail.services || detail.services.length === 0 ? <p className="text-sm text-gray-500">No services yet.</p> : (
                  <ul className="text-sm space-y-1">
                    {detail.services.map(s => (
                      <li key={s.id} className="flex justify-between border-b border-gray-100 py-1">
                        <span>{s.name} {s.route ? `(${s.route})` : ''}</span>
                        <span className="text-gray-500">{s.status} · BDT {s.price}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Recent Bookings ({detail.bookings?.length ?? 0})</h3>
                {!detail.bookings || detail.bookings.length === 0 ? <p className="text-sm text-gray-500">No bookings yet.</p> : (
                  <ul className="text-sm space-y-1">
                    {detail.bookings.map(b => (
                      <li key={b.id} className="flex justify-between border-b border-gray-100 py-1">
                        <span>#{b.bookingCode} · {b.user?.fullName || 'N/A'}</span>
                        <span className="text-gray-500">{b.status} · {b.paymentStatus}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-medium text-gray-800 capitalize">{value}</p>
    </div>
  );
}
