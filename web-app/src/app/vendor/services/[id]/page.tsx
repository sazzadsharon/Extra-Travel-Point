'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { API_CONFIG } from '../../../../config/api';
import type { Service } from '../../../../types/vendor';
import { Loader2, ArrowLeft, Save, AlertCircle, CheckCircle, Calendar, Clock, Trash2 } from 'lucide-react';

const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

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
    name: '', category: '', description: '', route: '', price: '', capacity: '', availability: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availForm, setAvailForm] = useState({ date: '', startTime: '', endTime: '', capacity: '' });
  const [availError, setAvailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setIsLoading(true);
    try {
      const { default: axios } = await import('axios');
      const res = await axios.get<Service>(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}`);
      setService(res.data);
      setForm({
        name: res.data.name,
        category: res.data.category,
        description: res.data.description || '',
        route: res.data.route || '',
        price: res.data.price.toString(),
        capacity: res.data.capacity?.toString() || '',
        availability: res.data.availability || '',
        status: res.data.status
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
      const { default: axios } = await import('axios');
      const res = await axios.get<Availability[]>(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}/availability`);
      setAvailabilities(res.data);
    } catch {
      /* ignore */
    }
  }, [serviceId]);

  useEffect(() => {
    if (user?.role === 'vendor') {
      load();
    }
  }, [user, load]);

  useEffect(() => {
    if (showAvailability && serviceId) {
      loadAvailabilities();
    }
  }, [showAvailability, serviceId, loadAvailabilities]);

  const update = (f: string, v: string) => {
    setForm(prev => ({ ...prev, [f]: v }));
    if (errors[f]) setErrors(prev => ({ ...prev, [f]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Service name is required';
    if (!form.price || parseFloat(form.price) <= 0) e.price = 'Enter a valid price';
    if (form.capacity && parseInt(form.capacity) <= 0) e.capacity = 'Capacity must be positive';
    if (Object.keys(e).length) setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate() || !service) return;
    setIsSubmitting(true);
    try {
      const { default: axios } = await import('axios');
      await axios.patch(`${API_CONFIG.API_BASE_URL}/vendors/services/${service.id}`, {
        name: form.name,
        category: form.category,
        description: form.description || undefined,
        route: form.route || undefined,
        price: parseFloat(form.price),
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        availability: form.availability || undefined,
        status: form.status
      });
      setSuccess(true);
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Failed to update service');
    } finally {
      setIsSubmitting(false);
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
      const { default: axios } = await import('axios');
      await axios.post(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}/availability`, {
        date: availForm.date,
        startTime: availForm.startTime || undefined,
        endTime: availForm.endTime || undefined,
        capacity: availForm.capacity ? parseInt(availForm.capacity) : undefined
      });
      setAvailForm({ date: '', startTime: '', endTime: '', capacity: '' });
      loadAvailabilities();
    } catch (err: any) {
      setAvailError(err.response?.data?.error || 'Failed to add availability');
    }
  };

  const deleteAvailability = async (id: number) => {
    try {
      const { default: axios } = await import('axios');
      await axios.delete(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}/availability/${id}`);
      loadAvailabilities();
    } catch {
      /* ignore */
    }
  };

  const deactivateService = async () => {
    if (!confirm('Deactivate this service? It will no longer be bookable.')) return;
    try {
      const { default: axios } = await import('axios');
      await axios.delete(`${API_CONFIG.API_BASE_URL}/vendors/services/${serviceId}`);
      router.push('/vendor/services');
    } catch {
      /* ignore */
    }
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Vendor access required.</p></div>;
  }
  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }
  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service not found.</p>
          <Link href="/vendor/services" className="bg-blue-600 text-white px-6 py-3 rounded-lg">Back to Services</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor/services" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Services
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Service</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${service.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {service.status}
          </span>
        </div>

        {success && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Service updated!</div>}
        {apiError && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{apiError}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
              <input className={cls} value={form.name} onChange={e => update('name', e.target.value)} />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select className={cls} value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="bus">Bus</option>
                <option value="launch">Launch / Boat</option>
                <option value="flight">Flight</option>
                <option value="hotel">Hotel</option>
                <option value="restaurant">Restaurant</option>
                <option value="tour">Tour / Activity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (BDT) *</label>
              <input className={cls} type="number" value={form.price} onChange={e => update('price', e.target.value)} />
              {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input className={cls} type="number" value={form.capacity} onChange={e => update('capacity', e.target.value)} />
              {errors.capacity && <p className="text-xs text-red-600 mt-1">{errors.capacity}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
            <input className={cls} value={form.route} onChange={e => update('route', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Availability Notes</label>
            <input className={cls} value={form.availability} onChange={e => update('availability', e.target.value)} placeholder="Daily, 06:00 AM departure" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className={cls} rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className={cls} value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
            <button type="button" onClick={deactivateService} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-3 rounded-lg font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Deactivate
            </button>
          </div>
        </form>

        <div className="mt-8">
          <button onClick={() => setShowAvailability(!showAvailability)} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium mb-4">
            <Calendar className="w-5 h-5" />
            {showAvailability ? 'Hide Availability' : 'Manage Availability'}
          </button>

          {showAvailability && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability Schedule</h2>

              {availError && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {availError}</div>}

              <form onSubmit={addAvailability} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" className={cls} value={availForm.date} onChange={e => setAvailForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" className={cls} value={availForm.startTime} onChange={e => setAvailForm(p => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" className={cls} value={availForm.endTime} onChange={e => setAvailForm(p => ({ ...p, endTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input type="number" className={cls} value={availForm.capacity} onChange={e => setAvailForm(p => ({ ...p, capacity: e.target.value }))} placeholder="40" />
                </div>
                <button type="submit" className="md:col-span-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> Add Availability
                </button>
              </form>

              {availabilities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No availability slots defined yet.</p>
              ) : (
                <div className="space-y-2">
                  {availabilities.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium text-gray-900">{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {a.startTime && <span className="text-gray-600">{a.startTime}{a.endTime ? ` - ${a.endTime}` : ''}</span>}
                        {a.capacity && <span className="text-gray-500">Cap: {a.capacity}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
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
  );
}
