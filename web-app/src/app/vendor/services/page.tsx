'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import type { Service, ServiceLifecycleStatus } from '../../../types/vendor';
import {
  Package, Plus, Pencil, Loader2, AlertCircle, ArrowLeft,
  Trash2, Eye, EyeOff, MapPin, Calendar, Tag,
  CheckCircle2, XCircle, Clock, Ban
} from 'lucide-react';

const LIFECYCLE_STYLE: Record<ServiceLifecycleStatus, { chip: string; icon: any; label: string }> = {
  DRAFT:          { chip: 'bg-slate-100 text-slate-700 border-slate-200',  icon: Clock,       label: 'Draft' },
  PENDING_REVIEW: { chip: 'bg-amber-100 text-amber-800 border-amber-200',  icon: Clock,       label: 'Pending Review' },
  PUBLISHED:      { chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2, label: 'Published' },
  REJECTED:       { chip: 'bg-red-100 text-red-700 border-red-200',        icon: XCircle,     label: 'Rejected' },
  SUSPENDED:      { chip: 'bg-orange-100 text-orange-800 border-orange-200', icon: Ban,        label: 'Suspended' },
  ARCHIVED:       { chip: 'bg-gray-100 text-gray-700 border-gray-200',     icon: Ban,         label: 'Archived' }
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

export default function VendorServicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | ServiceLifecycleStatus>('all');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<Service[]>(`/vendors/me/services`);
      setServices(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load services');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  const publish = async (s: Service) => {
    setActionId(s.id);
    try {
      await api.patch(`/vendors/me/services/${s.id}/publish`);
      showToast('ok', 'Service published');
      load();
    } catch (err: any) {
      showToast('err', err.response?.data?.error || 'Failed to publish');
    } finally {
      setActionId(null);
    }
  };

  const unpublish = async (s: Service) => {
    setActionId(s.id);
    try {
      await api.patch(`/vendors/me/services/${s.id}/unpublish`);
      showToast('ok', 'Service unpublished');
      load();
    } catch (err: any) {
      showToast('err', err.response?.data?.error || 'Failed to unpublish');
    } finally {
      setActionId(null);
    }
  };

  const remove = async (s: Service) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    setActionId(s.id);
    try {
      await api.delete(`/vendors/me/services/${s.id}`);
      showToast('ok', 'Service deleted');
      load();
    } catch (err: any) {
      showToast('err', err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionId(null);
    }
  };

  if (user?.role !== 'vendor') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Vendor access required.</p>
      </div>
    );
  }

  const filtered = filter === 'all' ? services : services.filter(s => (s.lifecycleStatus ?? 'DRAFT') === filter);
  const counts = {
    total: services.length,
    published: services.filter(s => s.lifecycleStatus === 'PUBLISHED').length,
    draft: services.filter(s => s.lifecycleStatus === 'DRAFT').length,
    suspended: services.filter(s => s.lifecycleStatus === 'SUSPENDED' || s.lifecycleStatus === 'REJECTED').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-etp-600 hover:text-etp-700 mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {toast && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${toast.kind === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'}`}>
            {toast.msg}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-etp-50 text-etp-700 px-3 py-1 rounded-full text-xs font-medium mb-2">
                <Package className="w-3.5 h-3.5" /> My Services
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Service Catalog</h1>
              <p className="text-slate-500 mt-1">Manage every tour, hotel and activity you offer on ETP.</p>
            </div>
            <Link
              href="/vendor/services/new"
              className="bg-gradient-to-r from-etp-600 to-violet-600 hover:from-etp-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 shadow-etp-sm"
            >
              <Plus className="w-4 h-4" /> Add Service
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-slate-50/50 border-b border-slate-100">
            {[
              { label: 'Total', value: counts.total, color: 'text-slate-700' },
              { label: 'Published', value: counts.published, color: 'text-emerald-700' },
              { label: 'Drafts', value: counts.draft, color: 'text-slate-700' },
              { label: 'Action needed', value: counts.suspended, color: 'text-orange-700' }
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{s.label}</div>
                <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="px-6 sm:px-8 py-4 border-b border-slate-100 flex flex-wrap gap-2">
            {(['all', 'PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  filter === f
                    ? 'bg-etp-600 text-white border-etp-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? 'All' : LIFECYCLE_STYLE[f as ServiceLifecycleStatus]?.label ?? f}
              </button>
            ))}
          </div>

          {error && (
            <div className="m-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-etp-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 sm:p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-etp-50 mb-4">
                <Package className="w-8 h-8 text-etp-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {filter === 'all' ? 'No services yet' : `No ${LIFECYCLE_STYLE[filter as ServiceLifecycleStatus]?.label ?? filter} services`}
              </h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Add your first service to start receiving bookings on Extra Travel Point.
              </p>
              <Link
                href="/vendor/services/new"
                className="bg-gradient-to-r from-etp-600 to-violet-600 text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2 shadow-etp-sm"
              >
                <Plus className="w-4 h-4" /> Add your first service
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-6 py-3">Service</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(s => {
                    const lc: ServiceLifecycleStatus = (s.lifecycleStatus as ServiceLifecycleStatus) ?? 'DRAFT';
                    const meta = LIFECYCLE_STYLE[lc];
                    const Icon = meta.icon;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-500 capitalize">
                            {s.serviceType?.replace('_', ' ').toLowerCase() ?? s.category}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            <Tag className="w-3 h-3" /> {s.category}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {s.currency ?? 'BDT'} {Number(s.price).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {s.locationCity ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.chip}`}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(s.updatedAt)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {lc === 'PUBLISHED' ? (
                              <button
                                onClick={() => unpublish(s)}
                                disabled={actionId === s.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-medium disabled:opacity-50"
                              >
                                <EyeOff className="w-3 h-3" /> Unpublish
                              </button>
                            ) : (
                              <button
                                onClick={() => publish(s)}
                                disabled={actionId === s.id || lc === 'SUSPENDED' || lc === 'REJECTED' || lc === 'ARCHIVED'}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium disabled:opacity-50"
                              >
                                <Eye className="w-3 h-3" /> Publish
                              </button>
                            )}
                            <button
                              onClick={() => router.push(`/vendor/services/${s.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-etp-50 text-etp-700 hover:bg-etp-100 text-xs font-medium"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => remove(s)}
                              disabled={actionId === s.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}