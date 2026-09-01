'use client';

import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { Fleet } from '../../../lib/types';

export default function FleetPage() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Fleet>('/api/v1/admin/fleet')
      .then(setFleet)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center text-slate-500 py-12">Loading…</p>;
  if (!fleet) return <p className="text-center text-slate-500 py-12">No fleet data</p>;

  const cards = [
    { title: 'Buses', icon: '🚌', data: fleet.buses },
    { title: 'Launches', icon: '⛴️', data: fleet.launches },
    { title: 'Flights', icon: '✈️', data: fleet.flights },
    { title: 'Hotels', icon: '🏨', data: fleet.hotels },
    { title: 'Drivers', icon: '👤', data: fleet.drivers },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-sky-600" />Fleet Overview</h2>
        <p className="text-sm text-slate-500">Network of transport & hospitality providers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">{c.title}</h3>
              <span className="text-2xl">{c.icon}</span>
            </div>
            <div className="space-y-2 text-sm">
              {c.data.length === 0 ? (
                <p className="text-slate-400">None registered</p>
              ) : c.data.map((d: any, i: number) => (
                <div key={i} className="border border-slate-100 rounded p-2 bg-slate-50">
                  {Object.entries(d).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-medium text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
