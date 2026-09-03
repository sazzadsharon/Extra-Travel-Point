'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, Bell, User, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const accountHref = user?.role === 'vendor' ? '/vendor' : user?.role === 'admin' ? '/admin/vendors' : '/dashboard';
  const accountLabel = user?.role === 'vendor' ? 'Vendor' : user?.role === 'admin' ? 'Admin' : 'Dashboard';

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/destinations', label: 'Destinations' },
    { href: '/plan-trip', label: 'Plan Trip' },
    { href: '/transport/bus', label: 'Buses' },
    { href: '/ai-assistant', label: 'AI Trips' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="sticky top-0 z-50 etp-glass border-b border-ink-100/80 shadow-etp-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-etp-700 via-etp-600 to-indigo-700 flex items-center justify-center shadow-etp-sm group-hover:shadow-etp-md transition-shadow">
              <span className="font-display font-bold text-white text-sm tracking-wider">ETP</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base text-ink-900 tracking-tight">
                Extra Travel Point
              </span>
              <span className="text-[10px] text-ink-400 font-semibold uppercase tracking-[0.18em]">
                Travel Super App
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'text-etp-700 bg-etp-50'
                    : 'text-ink-600 hover:text-etp-700 hover:bg-ink-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-ink-600 bg-ink-50 rounded-lg font-medium">
              EN <span className="w-px h-3 bg-ink-200" /> ৳ BDT
            </span>

            <button className="relative p-2 rounded-lg text-ink-500 hover:text-etp-700 hover:bg-ink-50 transition-colors" aria-label="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-etp-500 rounded-full ring-2 ring-white" />
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-ink-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-etp-600 to-indigo-800 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {user.fullName?.[0]?.toUpperCase() || user.phone[0]}
                  </div>
                  <span className="text-sm font-medium text-ink-700 max-w-[100px] truncate">
                    {user.fullName || 'User'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-ink-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-etp-md border border-ink-100 py-2 z-50">
                      <div className="px-4 py-3 border-b border-ink-100">
                        <p className="text-sm font-medium text-ink-900">{user.fullName || 'User'}</p>
                        <p className="text-xs text-ink-500">{user.phone}</p>
                      </div>
                      <Link
                        href={accountHref}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4 text-ink-400" />
                        {accountLabel}
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-ink-700 hover:text-etp-700 hover:bg-ink-50 transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-etp-700 to-indigo-700 hover:from-etp-800 hover:to-indigo-800 transition-colors shadow-etp-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-ink-600 hover:text-etp-700 hover:bg-ink-50 transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isOpen && (
          <div className="lg:hidden mt-2 pb-4 border-t border-ink-100 pt-4 animate-fade-in-up">
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-etp-700 bg-etp-50'
                      : 'text-ink-600 hover:text-etp-700 hover:bg-ink-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-2 mt-2 border-t border-ink-100">
                <p className="px-3 pb-2 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                  {user ? 'Account' : 'Get Started'}
                </p>
                {user ? (
                  <>
                    <Link
                      href={accountHref}
                      onClick={() => setIsOpen(false)}
                      className="px-3 py-2.5 rounded-lg text-sm font-medium text-ink-600 hover:text-etp-700 hover:bg-ink-50"
                    >
                      {accountLabel}
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 mt-1 px-3">
                    <Link
                      href="/login"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium text-center border border-ink-200 text-ink-700 hover:bg-ink-50"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium text-center text-white bg-gradient-to-r from-etp-700 to-indigo-700"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}