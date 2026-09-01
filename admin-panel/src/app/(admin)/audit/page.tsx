'use client';

import React, { useEffect, useState } from 'react';
import { ScrollText, Clock } from 'lucide-react';
import { api } from '../../../lib/api';
import { AuditLog } from '../../../lib/types';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AuditLog[]>('/api/v1/admin/audit-logs')
      .then(d => setLogs(d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ScrollText className="w-5 h-5 text-sky-600" />Audit Logs</h2>
        <p className="text-sm text-slate-500">Track administrative actions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Action</th>
                <th className="p-4">Admin</th>
                <th className="p-4">Details</th>
                <th className="p-4">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">No logs yet</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-mono text-xs">{l.id}</td>
                  <td className="p-4"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-800">{l.action}</span></td>
                  <td className="p-4">#{l.adminId}</td>
                  <td className="p-4 text-slate-700">{l.details}</td>
                  <td className="p-4 text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
