'use client';

import Link from 'next/link';
import { Gift, Sparkles, Check } from 'lucide-react';

const tiers = [
  { tier: 'Bronze', points: '1× per ৳100', color: 'bg-amber-700/20 text-amber-200 border-amber-300/30' },
  { tier: 'Silver', points: '1.5× per ৳100', color: 'bg-slate-300/20 text-slate-100 border-slate-200/30' },
  { tier: 'Gold', points: '2× per ৳100', color: 'bg-yellow-400/20 text-yellow-200 border-yellow-300/40' },
];

export default function RewardsSection() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-etp-900 to-indigo-950 p-8 md:p-12">
          <div className="absolute inset-0 etp-grain pointer-events-none" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-etp-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 etp-glass-dark border border-white/15 rounded-full px-4 py-1.5 mb-5">
                <Sparkles className="w-4 h-4 text-etp-300" />
                <span className="text-sm font-medium text-white">ETP Rewards Club</span>
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-3 leading-tight tracking-tight">
                Travel more. <br />
                Earn more.
              </h2>
              <p className="text-ink-200 text-base md:text-lg mb-7 max-w-xl mx-auto lg:mx-0">
                Collect ETP Points on every booking — then redeem for discounts,
                upgrades and exclusive cashback across Bangladesh.
              </p>

              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-7">
                {tiers.map((t) => (
                  <span
                    key={t.tier}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-sm text-xs font-semibold ${t.color}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t.tier} — {t.points}
                  </span>
                ))}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-white text-ink-950 font-semibold px-6 py-3.5 rounded-2xl shadow-etp-md hover:-translate-y-0.5 transition-all"
              >
                <Gift className="w-4 h-4 text-etp-700" />
                Check My Points
              </Link>
            </div>

            {/* Elegant rewards card */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-sm">
                <div className="absolute -top-6 -left-6 w-28 h-28 bg-etp-400/30 rounded-full blur-2xl" />
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-400/30 rounded-full blur-2xl" />
                <div className="relative aspect-[1.586/1] rounded-3xl bg-gradient-to-br from-ink-800 via-ink-900 to-black p-6 shadow-etp-lg border border-white/10 overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-etp-500/40 to-transparent rounded-full blur-2xl" />
                  <div className="relative h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-300 font-semibold">
                        ETP Points
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-etp-500 to-indigo-600 flex items-center justify-center">
                        <Gift className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="font-display text-5xl md:text-6xl font-bold text-white tracking-tight">
                        2,450
                      </p>
                      <p className="text-ink-300 text-sm mt-1">≈ ৳1,225 in rewards</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-300">
                      <div>
                        <p className="uppercase tracking-[0.18em] text-[10px] font-semibold">Member</p>
                        <p className="text-ink-100 font-semibold">Tanvir Ahmed</p>
                      </div>
                      <div className="text-right">
                        <p className="uppercase tracking-[0.18em] text-[10px] font-semibold">Tier</p>
                        <p className="text-etp-200 font-semibold">Gold</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}