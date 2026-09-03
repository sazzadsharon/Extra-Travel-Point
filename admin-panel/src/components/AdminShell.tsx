'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, Users, BarChart3, Settings, LogOut, Building2, ShieldAlert, ScrollText, Star, Package, Banknote
} from 'lucide-react';

const nav = [
  { href: '/', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { href: '/bookings', label: 'বুকিং ম্যানেজমেন্ট', icon: BookOpen },
  { href: '/vendors', label: 'সার্ভিস প্রোভাইডার', icon: Building2 },
  { href: '/vendor-services', label: 'Vendor Services', icon: Package },
  { href: '/users', label: 'User Management', icon: Users },
  { href: '/payouts', label: 'Payouts', icon: Banknote },
  { href: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { href: '/fraud', label: 'Fraud Detection', icon: ShieldAlert },
  { href: '/audit', label: 'Audit Logs', icon: ScrollText },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/fleet', label: 'Fleet Overview', icon: Building2 },
  { href: '/commissions', label: 'Commissions & Coupons', icon: Settings },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('etp_admin_user');
    const token = window.localStorage.getItem('etp_admin_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/health`);
        if (!cancelled) setBackendOnline(res.ok);
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    }
    ping();
    const id = setInterval(ping, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const logout = () => {
    window.localStorage.removeItem('etp_admin_token');
    window.localStorage.removeItem('etp_admin_user');
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
          <div className="bg-sky-500 p-2 rounded-lg"><LayoutDashboard size={22} /></div>
          <div>
            <h1 className="font-bold leading-tight">এক্সট্রাভেল পয়েন্ট</h1>
            <p className="text-xs text-slate-400">Admin Control Panel</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold">
                {(user?.fullName || user?.phone || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.fullName || 'Admin'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.phone || user?.email || 'admin'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-slate-800 hover:bg-red-600 transition"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Extra Travel Point — Admin</h2>
            <p className="text-xs text-slate-500">Travel Super App Operations</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            backendOnline === false
              ? 'bg-red-100 text-red-800'
              : backendOnline === null
              ? 'bg-slate-100 text-slate-600'
              : 'bg-green-100 text-green-800'
          }`}>
            ● Backend {backendOnline === false ? 'Offline' : backendOnline === null ? '...' : 'Online'}
          </span>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
