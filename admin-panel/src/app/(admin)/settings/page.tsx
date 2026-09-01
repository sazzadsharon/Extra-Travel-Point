'use client';

import React, { useState } from 'react';
import { Save, RefreshCw, Globe, Phone, Mail, Database, Settings as Cog, Bell, Shield, CheckCircle } from 'lucide-react';

interface Setting {
  id: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'toggle' | 'select';
  value: string | number | boolean;
  options?: string[];
  icon: React.ReactNode;
}

const DEFAULTS: Setting[] = [
  { id: 'site_name', label: 'Site Name', description: 'The name of your travel platform', type: 'text', value: 'Extra Travel Point', icon: <Globe className="w-5 h-5 text-sky-500" /> },
  { id: 'support_phone', label: 'Support Phone', description: 'Customer support phone number', type: 'text', value: '01309494898', icon: <Phone className="w-5 h-5 text-green-500" /> },
  { id: 'support_email', label: 'Support Email', description: 'Customer support email address', type: 'text', value: 'sharrron@yahoo.com', icon: <Mail className="w-5 h-5 text-blue-500" /> },
  { id: 'currency', label: 'Currency', description: 'Default currency for transactions', type: 'select', value: 'BDT', options: ['BDT', 'USD', 'EUR'], icon: <Database className="w-5 h-5 text-purple-500" /> },
  { id: 'commission_rate', label: 'Default Commission Rate (%)', description: 'Default commission percentage for vendors', type: 'number', value: 10, icon: <Cog className="w-5 h-5 text-amber-500" /> },
  { id: 'max_booking_days', label: 'Max Booking Advance (days)', description: 'Maximum days in advance a booking can be made', type: 'number', value: 90, icon: <RefreshCw className="w-5 h-5 text-indigo-500" /> },
  { id: 'enable_notifications', label: 'Enable Notifications', description: 'Send email/SMS notifications to users', type: 'toggle', value: true, icon: <Bell className="w-5 h-5 text-pink-500" /> },
  { id: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the site in maintenance mode', type: 'toggle', value: false, icon: <Shield className="w-5 h-5 text-red-500" /> },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const update = (id: string, value: string | number | boolean) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, value } : s));
    setSaved(false);
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-800">System Settings</h2>
        <p className="text-sm text-slate-500">Configure platform preferences</p>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4" /> Settings saved (local preview — backend persistence TBD)
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {settings.map(s => (
          <div key={s.id} className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">{s.icon}</div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{s.label}</p>
                <p className="text-sm text-slate-500 truncate">{s.description}</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {s.type === 'text' && (
                <input type="text" value={s.value as string} onChange={e => update(s.id, e.target.value)}
                  className="w-56 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500" />
              )}
              {s.type === 'number' && (
                <input type="number" value={s.value as number} onChange={e => update(s.id, parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500" />
              )}
              {s.type === 'select' && (
                <select value={s.value as string} onChange={e => update(s.id, e.target.value)}
                  className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500">
                  {s.options?.map(o => <option key={o}>{o}</option>)}
                </select>
              )}
              {s.type === 'toggle' && (
                <button onClick={() => update(s.id, !s.value)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${s.value ? 'bg-sky-600' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${s.value ? 'left-7' : 'left-1'}`} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-sky-700">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-800 mb-4">System Information</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Info label="Platform Version" value="v1.0.0" />
          <Info label="Backend" value={<span className="text-emerald-600">Online</span>} />
          <Info label="Database" value="SQLite (Dev)" />
          <Info label="Environment" value="Development" />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="font-medium text-slate-900 mt-1">{value}</p>
    </div>
  );
}
