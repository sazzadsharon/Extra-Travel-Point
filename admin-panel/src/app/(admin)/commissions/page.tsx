'use client';

import React, { useEffect, useState } from 'react';
import { Tag, Percent } from 'lucide-react';
import { api } from '../../../lib/api';
import { CommissionCoupon } from '../../../lib/types';

export default function CommissionsPage() {
  const [data, setData] = useState<CommissionCoupon | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<CommissionCoupon>('/api/v1/admin/commissions-coupons')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center text-slate-500 py-12">Loading…</p>;
  if (!data) return <p className="text-center text-slate-500 py-12">No data</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Percent className="w-5 h-5 text-sky-600" />Commissions & Coupons</h2>
        <p className="text-sm text-slate-500">Default rates and active promotions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Default Commission Rates</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(data.defaultCommissionRates).map(([k, v]) => (
            <div key={k} className="p-3 border border-slate-100 rounded-lg bg-slate-50 text-center">
              <p className="text-xs text-slate-500 uppercase">{k}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-slate-800">Active Coupons</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">Code</th>
                <th className="p-4">Discount</th>
                <th className="p-4">Max Discount</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.activeCoupons.map(c => (
                <tr key={c.code} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-sky-700 flex items-center gap-2"><Tag className="w-4 h-4" />{c.code}</td>
                  <td className="p-4">{c.discountPercent}%</td>
                  <td className="p-4">৳ {c.maxDiscountBDT.toLocaleString()}</td>
                  <td className="p-4"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
