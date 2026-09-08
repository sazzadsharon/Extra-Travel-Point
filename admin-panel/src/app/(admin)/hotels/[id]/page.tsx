'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Ban, RefreshCw, MapPin, Phone, Star, BedDouble, Loader2, Calendar, DollarSign } from 'lucide-react';
import { api } from '../../../../lib/api';

interface AdminHotelDetail {
  id: number;
  businessName: string;
  description?: string;
  address: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  starRating?: number;
  status: string;
  isVerified: boolean;
  isActive: boolean;
  isPublished: boolean;
  lifecycleStatus: string;
  rating: number;
  totalReviews: number;
  rejectionReason?: string | null;
  rooms: Array<{ id: number; name: string; type: string; price: number; totalRooms: number; capacity: number; status: string }>;
  hotelImages: Array<{ id: number; url: string; caption?: string; isPrimary: boolean }>;
  hotelAmenities: Array<{ id: number; name: string; icon?: string }>;
  hotelPolicy?: any;
  hotelPromotions?: Array<{ id: number; code: string; name: string; isActive: boolean }>;
}

export default function AdminHotelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [hotel, setHotel] = useState<AdminHotelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data: any = await api(`/api/v1/hotels/manage/${id}`);
      setHotel(data.hotel || data);
    } catch (e) {
      setToast({ kind: 'err', msg: 'Failed to load hotel' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const action = async (act: 'approve' | 'suspend' | 'reject' | 'restore') => {
    if (!hotel) return;
    setActionLoading(act);
    try {
      const body: any = {};
      if (act === 'reject' || act === 'suspend') body.reason = reason || undefined;
      await api(`/api/v1/hotels/admin/${hotel.id}/${act}`, { method: 'POST', body });
      setToast({ kind: 'ok', msg: `Hotel ${act}d` });
      setReason('');
      await load();
    } catch (e: any) {
      setToast({ kind: 'err', msg: `Failed to ${act} hotel: ${e?.message || 'unknown'}` });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;
  if (!hotel) return <div className="p-8">Hotel not found.</div>;

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className={`p-3 rounded ${toast.kind === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to hotels
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{hotel.businessName}</h1>
          <div className="flex items-center gap-2 mt-1 text-gray-600">
            <MapPin size={14} /> {hotel.address}
            {hotel.city && <span>· {hotel.city}</span>}
            {hotel.starRating && <span className="flex items-center gap-1"><Star size={14} className="text-amber-500" /> {hotel.starRating}</span>}
          </div>
          {hotel.phone && <div className="flex items-center gap-2 text-gray-600 mt-1"><Phone size={14} /> {hotel.phone}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-3 py-1 rounded-full text-xs ${hotel.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {hotel.status}
          </span>
          <span className="text-xs text-gray-500">Lifecycle: {hotel.lifecycleStatus}</span>
          <span className="text-xs text-gray-500">Published: {hotel.isPublished ? 'Yes' : 'No'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">Total Rooms</div>
          <div className="text-2xl font-bold">{hotel.rooms.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">Inventory Capacity</div>
          <div className="text-2xl font-bold">{hotel.rooms.reduce((s, r) => s + r.totalRooms, 0)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">Reviews</div>
          <div className="text-2xl font-bold">{hotel.totalReviews} <span className="text-sm text-gray-500">({hotel.rating.toFixed(1)}★)</span></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Description</h2>
        <p className="text-gray-700">{hotel.description || 'No description provided.'}</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Amenities</h2>
        {hotel.hotelAmenities.length === 0 ? (
          <p className="text-gray-500">None listed.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hotel.hotelAmenities.map(a => (
              <span key={a.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">{a.name}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><BedDouble size={18} /> Rooms ({hotel.rooms.length})</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Type</th>
              <th className="text-right p-2">Price/Night</th>
              <th className="text-right p-2">Capacity</th>
              <th className="text-right p-2">Total Rooms</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {hotel.rooms.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2 text-right">৳{r.price}</td>
                <td className="p-2 text-right">{r.capacity}</td>
                <td className="p-2 text-right">{r.totalRooms}</td>
                <td className="p-2"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Admin Actions</h2>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Reason (for suspend/reject)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => action('approve')} disabled={!!actionLoading} className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
              <Check size={14} /> {actionLoading === 'approve' ? '...' : 'Approve'}
            </button>
            <button onClick={() => action('suspend')} disabled={!!actionLoading} className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50">
              <Ban size={14} /> {actionLoading === 'suspend' ? '...' : 'Suspend'}
            </button>
            <button onClick={() => action('reject')} disabled={!!actionLoading} className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
              <X size={14} /> {actionLoading === 'reject' ? '...' : 'Reject'}
            </button>
            <button onClick={() => action('restore')} disabled={!!actionLoading} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              <RefreshCw size={14} /> {actionLoading === 'restore' ? '...' : 'Restore'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
