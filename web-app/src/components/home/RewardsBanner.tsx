'use client';

import Link from 'next/link';
import { Gift, Sparkles, Check } from 'lucide-react';

const tierBenefits = [
  { tier: 'Bronze', points: '1× per ৳100', color: 'bg-amber-700/20 text-amber-300 border-amber-300/30' },
  { tier: 'Silver', points: '1.5× per ৳100', color: 'bg-gray-300/20 text-gray-100 border-gray-200/30' },
  { tier: 'Gold', points: '2× per ৳100', color: 'bg-accent-400/20 text-accent-300 border-accent-400/40' },
];

export default function RewardsBanner() {
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-900 to-primary-950 rounded-3xl p-8 md:p-12">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/15 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 border border-white/10">
                <Sparkles className="w-4 h-4 text-accent-300" />
                <span className="text-sm font-medium text-white">ETP Rewards Club</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
                Earn on every single booking
              </h2>
              <p className="text-primary-100 text-lg mb-6 max-w-xl">
                Collect ETP Points on buses, hotels and tours — then redeem them for discounts, upgrades
                and exclusive cashback.
              </p>

              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-6">
                {tierBenefits.map((tier) => (
                  <span
                    key={tier.tier}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-sm text-xs font-semibold ${tier.color}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {tier.tier} — {tier.points}
                  </span>
                ))}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-primary-950 font-bold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-accent-500/20"
              >
                <Gift className="w-4 h-4" />
                Check My Points
              </Link>
            </div>

            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-48 h-48 md:w-56 md:h-56 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-accent-400/40 shadow-2xl animate-float-slow">
                  <div className="text-center">
                    <Gift className="w-16 h-16 md:w-20 md:h-20 text-accent-300 mx-auto mb-3" />
                    <p className="font-display text-3xl md:text-4xl font-bold text-white">2,450</p>
                    <p className="text-sm text-primary-100 font-medium">ETP Points</p>
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 w-12 h-12 bg-accent-400 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-primary-950" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}