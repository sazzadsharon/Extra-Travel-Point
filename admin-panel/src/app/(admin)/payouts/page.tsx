'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, Check, X, Ban, RotateCcw, Eye, Banknote, Loader2, AlertCircle, XCircle, CheckCircle, MapPin, Phone, Mail, Tag, Calendar, DollarSign, Shield
} from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { PayoutRequest, PayoutDetail, VendorBalance } from '../../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  PAYOUT_REQUESTED: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-200 text-gray-800',
};

const STATUSES = ['PAYOUT_REQUESTED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED'] as const;

const METHOD_STYLES: Record<string, string> = {
  BANK: 'bg-slate-100 text-slate-800',
  BKASH: 'bg-pink-100 text-pink-800',
  NAGAD: 'bg-orange-100 text-orange-800',
  ROCKET: 'bg-purple-100 text-purple-800',
};

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [detail, setDetail] = useState<PayoutDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [markPaidRef, setMarkPaidRef] = useState('');
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveRef, setApproveRef] = useState('');
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const qs = params.toString();
      const data = await api<{ count: number; payouts: PayoutRequest[] }>(`/api/v1/admin/payouts${qs ? `?${qs}` : ''}`);
      setPayouts(data.payouts || []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const openDetail = async (payout: PayoutRequest) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api<PayoutDetail>(`/api/v1/admin/payouts/${payout.id}`);
      setDetail(data);
    } catch (e) {
      showToast('err', 'Failed to load payout detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitApprove = async () => {
    if (!approveId) return;
    setApproveSubmitting(true);
    try {
      await api(`/api/v1/admin/payouts/${approveId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ transactionRef: approveRef || undefined })
      });
      showToast('ok', 'Payout approved successfully');
      setApproveOpen(false);
      setApproveId(null);
      setApproveRef('');
      await load();
    } catch (e) {
      showToast('err', e instanceof ApiError ? e.message : 'Approve failed');
    } finally {
      setApproveSubmitting(false);
    }
  };

  const submitReject = async () => {
    if (!rejectId) return;
    if (!rejectReason || rejectReason.trim().length < 3) {
      showToast('err', 'Rejection reason must be at least 3 characters');
      return;
    }
    setRejectSubmitting(true);
    try {
      await api(`/api/v1/admin/payouts/${rejectId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      showToast('ok', 'Payout rejected');
      setRejectOpen(false);
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (e) {
      showToast('err', e instanceof ApiError ? e.message : 'Reject failed');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const submitMarkPaid = async () => {
    if (!markPaidId) return;
    if (!markPaidRef || markPaidRef.trim().length === 0) {
      showToast('err', 'Transaction reference is required');
      return;
    }
    setMarkPaidSubmitting(true);
    try {
      await api(`/api/v1/admin/payouts/${markPaidId}/mark-paid`, {
        method: 'PATCH',
        body: JSON.stringify({ transactionRef: markPaidRef.trim() })
      });
      showToast('ok', 'Payout marked as paid');
      setMarkPaidOpen(false);
      setMarkPaidId(null);
      setMarkPaidRef('');
      await load();
    } catch (e) {
      showToast('err', e instanceof ApiError ? e.message : 'Mark paid failed');
    } finally {
      setMarkPaidSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return payouts.filter(p => {
      const matchSearch = !q ||
        (p.provider?.businessName || '').toLowerCase().includes(q) ||
        (p.provider?.user?.fullName || '').toLowerCase().includes(q) ||
        (p.provider?.user?.phone || '').includes(q) ||
        p.method.toLowerCase().includes(q) ||
        (p.transactionRef || '').toLowerCase().includes(q) ||
        String(p.id).includes(q);
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [payouts, search, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payouts) {
      map[p.status] = (map[p.status] || 0) + 1;
    }
    return map;
  }, [payouts]);

  const canAct = (p: PayoutRequest) => {
    if (p.status === 'PAYOUT_REQUESTED') return { approve: true, reject: true, markPaid: false };
    if (p.status === 'PROCESSING') return { approve: false, reject: true, markPaid: true };
    return { approve: false, reject: false, markPaid: false };
  };

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
            <Banknote className="w-5 h-5 text-sky-600" /> Payout Management
          </h2>
          <p className="text-sm text-slate-500">Review and process vendor payout requests</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUSES.map(s => (
          <div key={s} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-sky-300 transition" onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}>
            <div className="text-xs text-slate-500">{s.replace(/_/g, ' ')}</div>
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
              placeholder="Search by vendor, method, ref, or payout ID…"
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
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Vendor</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading payouts…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="p-12 text-center text-red-600 flex items-center justify-center gap-2"><XCircle className="w-4 h-4" /> Failed to load payouts</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500">No payouts match your filters</td></tr>
              ) : filtered.map(p => {
                const actions = canAct(p);
                return (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 font-mono text-xs">#{p.id}</td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-900">{p.provider?.businessName || '—'}</div>
                      <div className="text-xs text-slate-500">{p.provider?.user?.phone || p.provider?.user?.email || ''}</div>
                    </td>
                    <td className="p-4 font-medium">{Number(p.amount).toLocaleString()} {p.currency}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${METHOD_STYLES[p.method] || 'bg-slate-100 text-slate-700'}`}>
                        {p.method}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-700'}`}>{p.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="p-4 text-xs text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => openDetail(p)}
                          disabled={actionId === p.id}
                          className="p-1.5 rounded bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {actions.approve && (
                          <button
                            onClick={() => { setApproveId(p.id); setApproveRef(p.transactionRef || ''); setApproveOpen(true); }}
                            disabled={actionId === p.id}
                            className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {actions.reject && (
                          <button
                            onClick={() => { setRejectId(p.id); setRejectReason(''); setRejectOpen(true); }}
                            disabled={actionId === p.id}
                            className="p-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {actions.markPaid && (
                          <button
                            onClick={() => { setMarkPaidId(p.id); setMarkPaidRef(''); setMarkPaidOpen(true); }}
                            disabled={actionId === p.id}
                            className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            title="Mark as paid"
                          >
                            <Banknote className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Payout Details</h3>
              <button onClick={() => setDetail(null)} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
              ) : (
                <>
                  <section>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Vendor Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Info label="Business Name" value={detail.payout.provider?.businessName || '—'} />
                      <Info label="Vendor Status" value={<span className={`px-2.5 py-1 rounded-full text-xs font-medium ${detail.payout.provider?.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{detail.payout.provider?.status || '—'}</span>} />
                      <Info label="KYC Status" value={detail.payout.provider?.kycStatus || '—'} />
                      <Info label="Contact" value={detail.payout.provider?.user?.phone || detail.payout.provider?.user?.email || '—'} />
                    </div>
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Payout Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Info label="Payout ID" value={`#${detail.payout.id}`} />
                      <Info label="Status" value={<span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[detail.payout.status] || 'bg-slate-100 text-slate-700'}`}>{detail.payout.status.replace(/_/g, ' ')}</span>} />
                      <Info label="Amount" value={`${Number(detail.payout.amount).toLocaleString()} ${detail.payout.currency}`} />
                      <Info label="Method" value={detail.payout.method} />
                      <Info label="Payout Details" value={detail.payout.payoutDetails || '—'} />
                      <Info label="Transaction Ref" value={detail.payout.transactionRef || '—'} />
                      <Info label="Rejection Reason" value={detail.payout.rejectionReason || '—'} />
                      <Info label="Created At" value={new Date(detail.payout.createdAt).toLocaleString()} />
                      <Info label="Processed At" value={detail.payout.processedAt ? new Date(detail.payout.processedAt).toLocaleString() : '—'} />
                      <Info label="Paid At" value={detail.payout.paidAt ? new Date(detail.payout.paidAt).toLocaleString() : '—'} />
                    </div>
                  </section>

                  {detail.balance && (
                    <section>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Financial Context</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Info label="Gross Sales" value={`৳ ${Number(detail.balance.grossSales).toLocaleString()}`} />
                        <Info label="Commission" value={`৳ ${Number(detail.balance.commissionTotal).toLocaleString()}`} />
                        <Info label="Net Earnings" value={`৳ ${Number(detail.balance.netEarnings).toLocaleString()}`} />
                        <Info label="Pending" value={`৳ ${Number(detail.balance.pendingBalance).toLocaleString()}`} />
                        <Info label="Paid Out" value={`৳ ${Number(detail.balance.paidOut).toLocaleString()}`} />
                        <Info label="Available" value={`৳ ${Number(detail.balance.availableBalance).toLocaleString()}`} />
                        <Info label="Payout Requested" value={`৳ ${Number(detail.balance.payoutRequested).toLocaleString()}`} />
                        <Info label="Commission Rate" value={detail.commissionRate != null ? `${detail.commissionRate}%` : '—'} />
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {approveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { if (!approveSubmitting) { setApproveOpen(false); setApproveId(null); } }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Confirm Approval</h3>
              <p className="text-sm text-slate-500 mt-1">This will move payout #{approveId} to PROCESSING.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference (optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  value={approveRef}
                  onChange={e => setApproveRef(e.target.value)}
                  placeholder="e.g. BANK-TXN-001"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { if (!approveSubmitting) { setApproveOpen(false); setApproveId(null); } }} disabled={approveSubmitting} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={submitApprove} disabled={approveSubmitting} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 flex items-center gap-2">
                {approveSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { if (!rejectSubmitting) { setRejectOpen(false); setRejectId(null); } }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Reject Payout</h3>
              <p className="text-sm text-slate-500 mt-1">Please provide a reason for rejecting payout #{rejectId}.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Minimum 3 characters"
                />
                {rejectReason && rejectReason.length < 3 && (
                  <p className="text-xs text-red-600 mt-1">Reason must be at least 3 characters</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { if (!rejectSubmitting) { setRejectOpen(false); setRejectId(null); } }} disabled={rejectSubmitting} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={submitReject} disabled={rejectSubmitting || (rejectReason.trim().length < 3)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-400 flex items-center gap-2">
                {rejectSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {markPaidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { if (!markPaidSubmitting) { setMarkPaidOpen(false); setMarkPaidId(null); } }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Mark as Paid</h3>
              <p className="text-sm text-slate-500 mt-1">Enter the transaction reference for payout #{markPaidId}.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  value={markPaidRef}
                  onChange={e => setMarkPaidRef(e.target.value)}
                  placeholder="e.g. BANK-TXN-123"
                />
                {markPaidRef && markPaidRef.trim().length === 0 && (
                  <p className="text-xs text-red-600 mt-1">Transaction reference is required</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { if (!markPaidSubmitting) { setMarkPaidOpen(false); setMarkPaidId(null); } }} disabled={markPaidSubmitting} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={submitMarkPaid} disabled={markPaidSubmitting || markPaidRef.trim().length === 0} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2">
                {markPaidSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="font-medium text-slate-900 mt-1">{value}</p>
    </div>
  );
}
