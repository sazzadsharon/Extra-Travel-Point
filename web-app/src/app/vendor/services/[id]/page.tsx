'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/apiClient';
import { useAuth } from '../../../../contexts/AuthContext';
import type { Service, ServiceType, ServiceLifecycleStatus } from '../../../../types/vendor';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../types/vendor';
import {
  Loader2, ArrowLeft, Save, AlertCircle, CheckCircle2,
  Calendar, Clock, Trash2, Eye, EyeOff, Tag, MapPin, DollarSign, Info
} from 'lucide-react';

const inputCls =
  'w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-etp-500 focus:border-etp-500 transition';

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

const LIFECYCLE_CHIP: Record<ServiceLifecycleStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800 border-amber-200',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  SUSPENDED: 'bg-orange-100 text-orange-800 border-orange-200',
  ARCHIVED: 'bg-gray-100 text-gray-700 border-gray-200'
};

interface Availability {
  id: number;
  date: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  isActive: boolean;
}

export default function EditServicePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const serviceId = params?.id ? parseInt(params.id as string) : null;

  const [service, setService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    serviceType: 'OTHER' as ServiceType,
    description: '',
    route: '',
    price: '',
    currency: 'BDT',
    capacity: '',
    availability: '',
    locationCity: '',
    locationAddress: '',
    imagesText: '',
    availableDays: [] as number[],
    startDate: '',
    endDate: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availForm, setAvailForm] = useState({ date: '', startTime: '', endTime: '', capacity: '' });
  const [availError, setAvailError] = useState<string | null>(null);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!serviceId) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await api.get<Service>(`/vendors/me/services/${serviceId}`);
      const s = res.data;
      setService(s);
      setForm({
        name: s.name,
        serviceType: (s.serviceType as ServiceType) ?? 'OTHER',
        description: s.description ?? '',
        route: s.route ?? '',
        price: s.price.toString(),
        currency: s.currency ?? 'BDT',
        capacity: s.capacity?.toString() ?? '',
        availability: s.availability ?? '',
        locationCity: s.locationCity ?? '',
        locationAddress: s.locationAddress ?? '',
        imagesText: s.images ? safeParseImages(s.images) : '',
        availableDays: safeParseDays(s.availableDays),
        startDate: s.startDate ? s.startDate.substring(0, 10) : '',
        endDate: s.endDate ? s.endDate.substring(0, 10) : ''
      });
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Failed to load service');
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  const loadAvailabilities = useCallback(async () => {
    if (!serviceId) return;
    try {
      const res = await api.get<Availability[]>(`/vendors/services/${serviceId}/availability`);
      setAvailabilities(res.data);
    } catch {
      /* ignore */
    }
  }, [serviceId]);

  useEffect(() => {
    if (user?.role === 'vendor') load();
  }, [user, load]);

  useEffect(() => {
    if (showAvailability && serviceId) loadAvailabilities();
  }, [showAvailability, serviceId, loadAvailabilities]);

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k as string]) setErrors(prev => ({ ...prev, [k as string]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Service name must be at least 2 characters';
    if (!form.price || parseFloat(form.price) < 0) e.price = 'Enter a valid price';
    if (!/^[A-Z]{3}$/.test(form.currency)) e.currency = 'Currency must be 3 uppercase letters';
    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      e.endDate = 'End date must be after start date';
    }
    if (Object.keys(e).length) setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate() || !service) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/vendors/me/services/${service.id}`, {
        name: form.name.trim(),
        serviceType: form.serviceType,
        description: form.description.trim() || undefined,
        route: form.route.trim() || undefined,
        price: parseFloat(form.price),
        currency: form.currency,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        availability: form.availability.trim() || undefined,
        locationCity: form.locationCity.trim() || undefined,
        locationAddress: form.locationAddress.trim() || undefined,
        images: form.imagesText.trim() ? form.imagesText.split(/\s*,\s*/).filter(Boolean) : undefined,
        availableDays: form.availableDays.length ? form.availableDays : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: any) {
      const data = err.response?.data;
      if (Array.isArray(data?.error)) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of data.error) {
          const k = issue.path?.[0];
          if (k) fieldErrors[k] = issue.message;
        }
        setErrors(fieldErrors);
        setApiError('Please fix the highlighted fields.');
      } else {
        setApiError(typeof data?.error === 'string' ? data.error : 'Failed to update service');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePublish = async () => {
    if (!service) return;
    const lc: ServiceLifecycleStatus = (service.lifecycleStatus as ServiceLifecycleStatus) ?? 'DRAFT';
    const endpoint = lc === 'PUBLISHED' ? 'unpublish' : 'publish';
    setActionId(service.id);
    try {
      await api.patch(`/vendors/me/services/${service.id}/${endpoint}`);
      showToast('ok', lc === 'PUBLISHED' ? 'Service unpublished' : 'Service published');
      await load();
    } catch (err: any) {
      showToast('err', err.response?.data?.error || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const remove = async () => {
    if (!service) return;
    if (!window.confirm(`Delete "${service.name}"? This cannot be undone.`)) return;
    setActionId(service.id);
    try {
      await api.delete(`/vendors/me/services/${service.id}`);
      router.push('/vendor/services');
    } catch (err: any) {
      showToast('err', err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionId(null);
    }
  };

  const addAvailability = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setAvailError(null);
    if (!availForm.date) {
      setAvailError('Date is required');
      return;
    }
    try {
      await api.post(`/vendors/services/${serviceId}/availability`, {
        date: availForm.date,
        startTime: availForm.startTime || undefined,
        endTime: availForm.endTime || undefined,
        capacity: availForm.capacity ? parseInt(availForm.capacity, 10) : undefined
      });
      setAvailForm({ date: '', startTime: '', endTime: '', capacity: '' });
      loadAvailabilities();
    } catch (err: any) {
      setAvailError(err.response?.data?.error || 'Failed to add availability');
    }
  };

  const deleteAvailability = async (id: number) => {
    try {
      await api.delete(`/vendors/services/${serviceId}/availability/${id}`);
      loadAvailabilities();
    } catch {
      /* ignore */
    }
  };

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(d)
        ? prev.availableDays.filter(x => x !== d)
        : [...prev.availableDays, d].sort()
    }));
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-600">Vendor access required.</p></div>;
  }
  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>;
  }
  if (!service) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Service not found.</p>
          <Link href="/vendor/services" className="bg-etp-600 text-white px-6 py-3 rounded-xl">Back to Services</Link>
        </div>
      </div>
    );
  }

  const lc: ServiceLifecycleStatus = (service.lifecycleStatus as ServiceLifecycleStatus) ?? 'DRAFT';
  const isPublished = lc === 'PUBLISHED';
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/services" className="inline-flex items-center gap-2 text-etp-600 hover:text-etp-700 mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Services
        </Link>

        {toast && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${toast.kind === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'}`}>
            {toast.msg}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-etp-50 via-white to-violet-50">
            <div>
              <div className="inline-flex items-center gap-2 bg-etp-100 text-etp-700 px-3 py-1 rounded-full text-xs font-medium mb-2">
                Edit service
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{service.name}</h1>
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${LIFECYCLE_CHIP[lc]}`}>
              <Tag className="w-3.5 h-3.5" /> {lc.replace('_', ' ')}
            </span>
          </div>

          {service.rejectionReason && lc === 'REJECTED' && (
            <div className="m-6 mb-0 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <strong>Rejected:</strong> {service.rejectionReason}
            </div>
          )}

          {success && (
            <div className="m-6 mb-0 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Service updated!
            </div>
          )}
          {apiError && (
            <div className="m-6 mb-0 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Basic information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Service Name *</label>
                  <input className={inputCls} value={form.name} onChange={e => update('name', e.target.value)} />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select className={inputCls} value={form.serviceType} onChange={e => update('serviceType', e.target.value as ServiceType)}>
                    {SERVICE_TYPES.map(t => (
                      <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Capacity</label>
                  <input className={inputCls} type="number" min={1} value={form.capacity} onChange={e => update('capacity', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Pricing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Price *</label>
                  <input className={inputCls} type="number" min={0} step="0.01" value={form.price} onChange={e => update('price', e.target.value)} />
                  {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label className={labelCls}>Currency *</label>
                  <input className={inputCls} value={form.currency} onChange={e => update('currency', e.target.value.toUpperCase())} maxLength={3} />
                  {errors.currency && <p className="text-xs text-red-600 mt-1">{errors.currency}</p>}
                </div>
                <div>
                  <label className={labelCls}>Route</label>
                  <input className={inputCls} value={form.route} onChange={e => update('route', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={form.locationCity} onChange={e => update('locationCity', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input className={inputCls} value={form.locationAddress} onChange={e => update('locationAddress', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Availability
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Start date</label>
                    <input className={inputCls} type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>End date</label>
                    <input className={inputCls} type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} />
                    {errors.endDate && <p className="text-xs text-red-600 mt-1">{errors.endDate}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Available days</label>
                  <div className="flex gap-2 flex-wrap">
                    {dayLabels.map((d, i) => {
                      const active = form.availableDays.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                            active
                              ? 'bg-etp-600 text-white border-etp-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Availability notes</label>
                  <input className={inputCls} value={form.availability} onChange={e => update('availability', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Description
              </h2>
              <textarea className={inputCls} rows={4} value={form.description} onChange={e => update('description', e.target.value)} />
            </section>

            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-etp-600 to-violet-600 hover:from-etp-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 shadow-etp-sm"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
              <button
                type="button"
                onClick={togglePublish}
                disabled={actionId === service.id || lc === 'SUSPENDED' || lc === 'REJECTED' || lc === 'ARCHIVED'}
                className="bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 px-5 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2"
              >
                {isPublished ? <><EyeOff className="w-4 h-4" /> Unpublish</> : <><Eye className="w-4 h-4" /> Publish</>}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={actionId === service.id}
                className="bg-red-50 hover:bg-red-100 text-red-700 px-5 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </form>

          <div className="px-6 sm:px-8 pb-8">
            <button
              onClick={() => setShowAvailability(s => !s)}
              className="flex items-center gap-2 text-etp-600 hover:text-etp-700 font-medium"
            >
              <Calendar className="w-5 h-5" />
              {showAvailability ? 'Hide Availability' : 'Manage Availability'}
            </button>

            {showAvailability && (
              <div className="mt-4 bg-slate-50 rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Availability Schedule</h3>

                {availError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {availError}
                  </div>
                )}

                <form onSubmit={addAvailability} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" className={inputCls} value={availForm.date} onChange={e => setAvailForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Start Time</label>
                    <input type="time" className={inputCls} value={availForm.startTime} onChange={e => setAvailForm(p => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>End Time</label>
                    <input type="time" className={inputCls} value={availForm.endTime} onChange={e => setAvailForm(p => ({ ...p, endTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Capacity</label>
                    <input type="number" className={inputCls} value={availForm.capacity} onChange={e => setAvailForm(p => ({ ...p, capacity: e.target.value }))} placeholder="40" />
                  </div>
                  <button type="submit" className="md:col-span-4 bg-etp-600 hover:bg-etp-700 text-white py-2.5 rounded-xl font-medium inline-flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" /> Add Availability
                  </button>
                </form>

                {availabilities.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No availability slots defined yet.</p>
                ) : (
                  <div className="space-y-2">
                    {availabilities.map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-200">
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="font-medium text-slate-900">
                            {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {a.startTime && <span className="text-slate-600">{a.startTime}{a.endTime ? ` - ${a.endTime}` : ''}</span>}
                          {a.capacity && <span className="text-slate-500">Cap: {a.capacity}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs ${a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {a.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <button onClick={() => deleteAvailability(a.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function safeParseImages(images: string): string {
  try {
    const arr = JSON.parse(images);
    if (Array.isArray(arr)) return arr.filter((x: any) => typeof x === 'string').join(', ');
  } catch { /* ignore */ }
  return '';
}

function safeParseDays(value?: string | null): number[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) return arr.filter((n: any) => Number.isInteger(n) && n >= 0 && n <= 6);
  } catch { /* ignore */ }
  return [];
}