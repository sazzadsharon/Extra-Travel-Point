'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Phone, Loader2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('01712345678');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ tokens: { accessToken: string; refreshToken: string }; user: any }>(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ phone, password }),
          auth: false,
        }
      );
      if (res.user?.role !== 'admin') {
        throw new Error('Admin credentials required');
      }
      window.localStorage.setItem('etp_admin_token', res.tokens.accessToken);
      window.localStorage.setItem('etp_admin_user', JSON.stringify(res.user));
      router.replace('/');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-sky-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 bg-sky-600 text-white rounded-xl items-center justify-center mb-3">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">ETP Admin Panel</h1>
          <p className="text-sm text-slate-500">Extra Travel Point Control Center</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <div className="mt-1 relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="01XXXXXXXXX"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </label>

          {error && (
            <div className="flex items-start gap-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-xs text-center text-slate-500">
          Demo Admin: <code className="bg-slate-100 px-1 rounded">01712345678 / admin123</code>
        </p>
      </div>
    </div>
  );
}
