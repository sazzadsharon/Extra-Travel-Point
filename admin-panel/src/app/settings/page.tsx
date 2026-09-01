'use client';

import React, { useState } from 'react';
import { Settings, Save, RefreshCw, Shield, Bell, Globe, Database, Mail, Phone } from 'lucide-react';

interface Setting {
  id: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'toggle' | 'select';
  value: string | number | boolean;
  options?: string[];
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<Setting[]>([
    { id: 'site_name', label: 'Site Name', description: 'The name of your travel platform', type: 'text', value: 'Extra Travel Point' },
    { id: 'support_phone', label: 'Support Phone', description: 'Customer support phone number', type: 'text', value: '01309494898' },
    { id: 'support_email', label: 'Support Email', description: 'Customer support email address', type: 'text', value: 'sharrron@yahoo.com' },
    { id: 'currency', label: 'Currency', description: 'Default currency for transactions', type: 'select', value: 'BDT', options: ['BDT', 'USD', 'EUR'] },
    { id: 'commission_rate', label: 'Default Commission Rate', description: 'Default commission percentage for vendors', type: 'number', value: 10 },
    { id: 'max_booking_days', label: 'Max Booking Advance Days', description: 'Maximum days in advance a booking can be made', type: 'number', value: 90 },
    { id: 'enable_notifications', label: 'Enable Notifications', description: 'Send email/SMS notifications to users', type: 'toggle', value: true },
    { id: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the site in maintenance mode', type: 'toggle', value: false },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateSetting = (id: string, value: string | number | boolean) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, value } : s));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setSettings([
      { id: 'site_name', label: 'Site Name', description: 'The name of your travel platform', type: 'text', value: 'Extra Travel Point' },
      { id: 'support_phone', label: 'Support Phone', description: 'Customer support phone number', type: 'text', value: '01309494898' },
      { id: 'support_email', label: 'Support Email', description: 'Customer support email address', type: 'text', value: 'sharrron@yahoo.com' },
      { id: 'currency', label: 'Currency', description: 'Default currency for transactions', type: 'select', value: 'BDT', options: ['BDT', 'USD', 'EUR'] },
      { id: 'commission_rate', label: 'Default Commission Rate', description: 'Default commission percentage for vendors', type: 'number', value: 10 },
      { id: 'max_booking_days', label: 'Max Booking Advance Days', description: 'Maximum days in advance a booking can be made', type: 'number', value: 90 },
      { id: 'enable_notifications', label: 'Enable Notifications', description: 'Send email/SMS notifications to users', type: 'toggle', value: true },
      { id: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the site in maintenance mode', type: 'toggle', value: false },
    ]);
  };

  const getSettingIcon = (id: string) => {
    const icons: Record<string, React.ReactNode> = {
      site_name: <Globe className="w-5 h-5 text-sky-500" />,
      support_phone: <Phone className="w-5 h-5 text-green-500" />,
      support_email: <Mail className="w-5 h-5 text-blue-500" />,
      currency: <Database className="w-5 h-5 text-purple-500" />,
      commission_rate: <Settings className="w-5 h-5 text-amber-500" />,
      max_booking_days: <RefreshCw className="w-5 h-5 text-indigo-500" />,
      enable_notifications: <Bell className="w-5 h-5 text-pink-500" />,
      maintenance_mode: <Shield className="w-5 h-5 text-red-500" />,
    };
    return icons[id] || <Settings className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">System Settings</h2>
          <p className="text-sm text-slate-500">Configure platform settings and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-sky-700 disabled:bg-slate-400"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Save className="w-4 h-4" />
          Settings saved successfully!
        </div>
      )}

      {/* Settings List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {settings.map(setting => (
          <div key={setting.id} className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                {getSettingIcon(setting.id)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{setting.label}</p>
                <p className="text-sm text-slate-500">{setting.description}</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {setting.type === 'text' && (
                <input
                  type="text"
                  value={setting.value as string}
                  onChange={e => updateSetting(setting.id, e.target.value)}
                  className="w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              )}
              {setting.type === 'number' && (
                <input
                  type="number"
                  value={setting.value as number}
                  onChange={e => updateSetting(setting.id, parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              )}
              {setting.type === 'select' && (
                <select
                  value={setting.value as string}
                  onChange={e => updateSetting(setting.id, e.target.value)}
                  className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  {setting.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {setting.type === 'toggle' && (
                <button
                  onClick={() => updateSetting(setting.id, !setting.value)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${setting.value ? 'bg-sky-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${setting.value ? 'left-7' : 'left-1'}`} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">System Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Platform Version</p>
            <p className="font-medium text-slate-900">v1.0.0</p>
          </div>
          <div>
            <p className="text-slate-500">Backend Status</p>
            <p className="font-medium text-green-600">Online</p>
          </div>
          <div>
            <p className="text-slate-500">Database</p>
            <p className="font-medium text-slate-900">SQLite (Dev)</p>
          </div>
          <div>
            <p className="text-slate-500">Environment</p>
            <p className="font-medium text-slate-900">Development</p>
          </div>
        </div>
      </div>
    </div>
  );
}
