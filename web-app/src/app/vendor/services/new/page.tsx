'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/apiClient';
import { useAuth } from '../../../../contexts/AuthContext';
import type { Vendor, ServiceType, ServiceLifecycleStatus } from '../../../../types/vendor';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../types/vendor';
import {
  Loader2, ArrowLeft, AlertCircle, CheckCircle2,
  Plus, Tag, MapPin, DollarSign, Calendar, Info, ImageIcon
} from 'lucide-react';

const inputCls =
  'w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-etp-500 focus:border-etp-500 transition';

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

export default function NewServicePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [provider, setProvider] = useState<Vendor | null>(null);
  const [form, setForm] = useState({
    name: '',
    serviceType: 'TOUR' as ServiceType,
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
    endDate: '',
    lifecycleStatus: 'DRAFT' as ServiceLifecycleStatus
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Vendor>(`/vendors/me`);
      setProvider(res.data);
    } catch {
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k as string]) setErrors(prev => ({ ...prev, [k as string]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Service name must be at least 2 characters';
    if (!form.price || parseFloat(form.price) < 0) e.price = 'Enter a valid price';
    if (!/^[A-Z]{3}$/.test(form.currency)) e.currency = 'Currency must be 3 uppercase letters (e.g. BDT)';
    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      e.endDate = 'End date must be after start date';
    }
    if (Object.keys(e).length) setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => ({
    providerId: provider?.id,
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
    endDate: form.endDate || undefined,
    lifecycleStatus: form.lifecycleStatus
  });

  const submit = async (lifecycleStatus: ServiceLifecycleStatus) => {
    setApiError(null);
    setErrors({});
    if (!validate() || !provider) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/vendors/me/services`, { ...buildPayload(), lifecycleStatus });
      setSuccess(true);
      setTimeout(() => router.push(`/vendor/services/${res.data.service.id}`), 600);
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
        setApiError(typeof data?.error === 'string' ? data.error : 'Failed to create service');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    await submit('DRAFT');
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
  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>;
  }
  if (provider && provider.status !== 'APPROVED') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/vendor/services" className="inline-flex items-center gap-2 text-etp-600 hover:text-etp-700 mb-4 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Approval required to publish</h3>
              <p className="text-sm">Only approved vendors can publish services on Extra Travel Point. Current status: <strong>{provider.status}</strong>.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/services" className="inline-flex items-center gap-2 text-etp-600 hover:text-etp-700 mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Services
        </Link>

        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-etp-50 via-white to-violet-50">
            <div className="inline-flex items-center gap-2 bg-etp-100 text-etp-700 px-3 py-1 rounded-full text-xs font-medium mb-3">
              <Plus className="w-3.5 h-3.5" /> New service
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Create a new service</h1>
            <p className="text-slate-500 mt-1">Add the details, price and availability. You can save a draft now and publish later.</p>
          </div>

          {success && (
            <div className="m-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Service created! Redirecting…
            </div>
          )}
          {apiError && (
            <div className="m-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Basic information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Service Name *</label>
                  <input className={inputCls} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Dhaka → Cox's Bazar Express" />
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
                  <label className={labelCls}>Capacity (optional)</label>
                  <input className={inputCls} type="number" min={1} value={form.capacity} onChange={e => update('capacity', e.target.value)} placeholder="40" />
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
                  <input className={inputCls} type="number" min={0} step="0.01" value={form.price} onChange={e => update('price', e.target.value)} placeholder="1200" />
                  {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label className={labelCls}>Currency *</label>
                  <input className={inputCls} value={form.currency} onChange={e => update('currency', e.target.value.toUpperCase())} maxLength={3} placeholder="BDT" />
                  {errors.currency && <p className="text-xs text-red-600 mt-1">{errors.currency}</p>}
                </div>
                <div>
                  <label className={labelCls}>Route (optional)</label>
                  <input className={inputCls} value={form.route} onChange={e => update('route', e.target.value)} placeholder="Dhaka → Cox's Bazar" />
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
                  <input className={inputCls} value={form.locationCity} onChange={e => update('locationCity', e.target.value)} placeholder="Dhaka" />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input className={inputCls} value={form.locationAddress} onChange={e => update('locationAddress', e.target.value)} placeholder="Gabtoli Bus Terminal" />
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
                  <input className={inputCls} value={form.availability} onChange={e => update('availability', e.target.value)} placeholder="Daily, 06:00 AM departure" />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Description
              </h2>
              <textarea className={inputCls} rows={4} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Tell customers what makes this service special…" />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Images (optional)
              </h2>
              <input className={inputCls} value={form.imagesText} onChange={e => update('imagesText', e.target.value)} placeholder="Paste image URLs separated by commas" />
              <p className="text-xs text-slate-500 mt-1">Comma-separated URLs. Leave blank if not applicable.</p>
            </section>

            <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save as Draft'}
              </button>
              <button
                type="button"
                disabled={isSubmitting || (provider?.status !== 'APPROVED')}
                onClick={() => submit('PUBLISHED')}
                className="flex-1 bg-gradient-to-r from-etp-600 to-violet-600 hover:from-etp-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 shadow-etp-sm"
              >
                <Tag className="w-4 h-4" /> Save &amp; Publish
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}