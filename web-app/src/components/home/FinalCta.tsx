'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function FinalCta() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-ink-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=2000&h=1200&fit=crop)',
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-950/85 to-etp-950/90" />
      <div className="absolute inset-0 bg-etp-radial" />
      <div className="absolute inset-0 etp-grain" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-flex items-center gap-2 etp-glass-dark border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white">
          ETP · Travel Super App
        </span>
        <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mt-6 leading-[1.02] tracking-tight">
          Travel Bangladesh. <br />
          <span className="text-gradient bg-gradient-to-r from-etp-200 via-white to-etp-100">
            The ETP Way.
          </span>
        </h2>
        <p className="text-ink-200 text-lg md:text-xl mt-6 max-w-2xl mx-auto leading-relaxed">
          From Cox&apos;s Bazar to Sajek — one app for every step of your journey.
          Start planning in minutes.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/plan-trip"
            className="group inline-flex items-center gap-2 bg-white text-ink-950 font-semibold px-8 py-4 rounded-2xl shadow-etp-md hover:-translate-y-0.5 transition-all"
          >
            Start Planning
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/destinations"
            className="inline-flex items-center justify-center gap-2 etp-glass-dark border border-white/20 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl transition-colors"
          >
            Explore Destinations
          </Link>
        </div>
      </div>
    </section>
  );
}