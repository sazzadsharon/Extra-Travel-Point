'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight, Wand2 } from 'lucide-react';

export default function AiPlannerSection() {
  return (
    <section className="relative py-20 md:py-24 overflow-hidden bg-gradient-to-br from-indigo-950 via-etp-950 to-ink-950 text-white">
      <div className="absolute inset-0 etp-grain pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-etp-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-6 animate-fade-in-up">
            <span className="inline-flex items-center gap-2 etp-glass-dark border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              <Sparkles className="w-3.5 h-3.5 text-etp-300" />
              ETP AI
            </span>
            <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold mt-6 leading-[1.05] tracking-tight">
              Plan your perfect trip with{' '}
              <span className="text-gradient bg-gradient-to-r from-etp-200 via-white to-etp-100">
                ETP AI
              </span>
            </h2>
            <p className="text-ink-200 text-lg mt-5 leading-relaxed max-w-xl">
              Tell ETP where you want to go and we&apos;ll help build your journey —
              combining buses, hotels and curated experiences into one personalised
              itinerary in seconds.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/plan-trip"
                className="group inline-flex items-center justify-center gap-2 bg-white text-ink-950 font-semibold px-7 py-4 rounded-2xl shadow-etp-md transition-all hover:-translate-y-0.5"
              >
                <Wand2 className="w-4 h-4 text-etp-700" />
                Plan with ETP AI
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/ai-assistant"
                className="inline-flex items-center justify-center gap-2 etp-glass-dark border border-white/20 hover:bg-white/10 text-white font-semibold px-7 py-4 rounded-2xl transition-colors"
              >
                Open AI Assistant
              </Link>
            </div>
          </div>

          {/* Chat mockup */}
          <div className="lg:col-span-6">
            <div className="relative max-w-md mx-auto">
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-etp-500/30 rounded-full blur-2xl" />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl" />
              <div className="relative etp-glass-dark border border-white/15 rounded-3xl p-5 shadow-etp-lg">
                <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="text-xs font-semibold text-ink-200 uppercase tracking-[0.18em]">
                    ETP AI · online
                  </span>
                </div>
                <div className="space-y-3 pt-4">
                  <div className="flex justify-end">
                    <div className="bg-gradient-to-r from-etp-600 to-indigo-600 text-white text-sm rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%]">
                      Plan a 3-day trip to Cox&apos;s Bazar from Dhaka for 2 people.
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white/10 border border-white/10 text-white text-sm rounded-2xl rounded-tl-md px-4 py-2.5 max-w-[88%]">
                      Here&apos;s your itinerary:
                      <ul className="mt-2 space-y-1 text-ink-100 text-xs">
                        <li>• Day 1 — Premium AC bus, sea-view hotel check-in</li>
                        <li>• Day 2 — Inani Beach + Himchari sunrise tour</li>
                        <li>• Day 3 — Marine drive & return</li>
                      </ul>
                      <p className="mt-2 text-etp-200 font-semibold text-xs">
                        Estimated ৳18,400 for 2 — earning 320 ETP Points.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 h-9 bg-white/5 border border-white/10 rounded-xl px-3 flex items-center text-xs text-ink-300">
                      Ask ETP anything about your trip…
                    </div>
                    <button className="h-9 w-9 bg-gradient-to-r from-etp-600 to-indigo-600 rounded-xl flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </button>
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