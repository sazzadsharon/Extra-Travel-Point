'use client';

import React, { useEffect, useState } from 'react';
import { Star, Check, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { Review } from '../../../lib/types';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api<Review[]>('/api/v1/admin/reviews/moderation')
      .then(d => setReviews(d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const moderate = async (id: number, action: 'APPROVE' | 'REJECT') => {
    try {
      await api(`/api/v1/admin/reviews/${id}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      setReviews(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" />Review Moderation</h2>
        <p className="text-sm text-slate-500">{reviews.length} pending reviews</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-slate-500 py-12">Loading…</p>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            No pending reviews
          </div>
        ) : reviews.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                  {r.user.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{r.user}</p>
                  <p className="text-xs text-slate-500">on {r.provider}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
              <p className="text-sm text-slate-700">{r.comment}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => moderate(r.id, 'APPROVE')} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-emerald-100">
                <Check className="w-4 h-4" />Approve
              </button>
              <button onClick={() => moderate(r.id, 'REJECT')} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-red-100">
                <X className="w-4 h-4" />Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
