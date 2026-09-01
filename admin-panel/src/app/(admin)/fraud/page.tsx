'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Activity, Clock } from 'lucide-react';
import { api } from '../../../lib/api';
import { FraudActivity } from '../../../lib/types';

export default function FraudPage() {
  const [activities, setActivities] = useState<FraudActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ suspiciousActivities: FraudActivity[] }>('/api/v1/admin/analytics/fraud-detection')
      .then(d => setActivities(d.suspiciousActivities || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sev = (s: string) => s === 'High' ? 'bg-red-100 text-red-800' : s === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Shield className="w-5 h-5 text-sky-600" />Fraud Detection Center</h2>
        <p className="text-sm text-slate-500">Suspicious activity monitor</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tile icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label="High Severity" value={activities.filter(a => a.severity === 'High').length} color="red" />
        <Tile icon={<Clock className="w-5 h-5 text-amber-600" />} label="Medium Severity" value={activities.filter(a => a.severity === 'Medium').length} color="amber" />
        <Tile icon={<Activity className="w-5 h-5 text-sky-600" />} label="Total Events" value={activities.length} color="sky" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">Type</th>
                <th className="p-4">User</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Detected</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">Loading…</td></tr>
              ) : activities.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">No suspicious activity detected 🎉</td></tr>
              ) : activities.map(a => (
                <tr key={a.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-medium">{a.type}</td>
                  <td className="p-4">#{a.userId}</td>
                  <td className="p-4 font-mono text-xs">{a.ip}</td>
                  <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sev(a.severity)}`}>{a.severity}</span></td>
                  <td className="p-4 text-xs text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
