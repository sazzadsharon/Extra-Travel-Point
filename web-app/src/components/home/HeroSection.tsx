'use client';

import Link from 'next/link';
import { ShieldCheck, Lock, Headphones, Gift, ArrowRight, Sparkles } from 'lucide-react';

const trustItems = [
  { icon: ShieldCheck, title: 'Secure Payments', desc: 'PCI-DSS encrypted checkout' },
  { icon: Lock, title: 'Verified Partners', desc: 'Trusted vendors across Bangladesh' },
  { icon: Headphones, title: '24/7 Support', desc: 'Bangla & English helpdesk' },
  { icon: Gift, title: 'Earn ETP Points', desc: 'Rewards on every booking' },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-[760px] md:min-h-[820px] flex items-end md:items-center overflow-hidden bg-ink-950">
      {/* Background imagery: layered Bangladesh travel scenes */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=2000&h=1200&fit=crop)',
        }}
        aria-hidden
      />
      {/* Cinematic gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/70 to-indigo-950/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
      <div className="absolute inset-0 bg-etp-radial opacity-90" />

      {/* Subtle mesh overlay */}
      <div className="absolute inset-0 etp-grain pointer-events-none" />

      {/* Decorative orbs */}
      <div className="absolute top-24 right-10 hidden lg:block w-80 h-80 bg-etp-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-32 left-8 hidden lg:block w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 w-full">
        <div className="max-w-3xl animate-fade-in-up">
          <span className="inline-flex items-center gap-2 etp-glass-dark border border-white/15 rounded-full px-4 py-2 mb-7 text-white text-xs sm:text-sm font-semibold uppercase tracking-[0.18em]">
            <Sparkles className="w-3.5 h-3.5 text-etp-300" />
            Bangladesh&apos;s Travel Super App
          </span>

          <h1 className="font-display text-white mb-6 leading-[1.02] tracking-tight text-[44px] sm:text-6xl md:text-7xl lg:text-[88px] font-bold">
            Your Journey.
            <br />
            <span className="text-gradient bg-gradient-to-r from-etp-200 via-white to-etp-100">
              One ETP.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-ink-200 mb-10 leading-relaxed max-w-xl font-light">
            Plan, book, travel and experience Bangladesh — all in one place.
            Premium buses, hand-picked hotels and curated journeys, with
            instant QR tickets and rewards on every trip.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-12">
            <Link
              href="/transport/bus"
              className="group inline-flex items-center justify-center gap-2 bg-white text-ink-950 font-semibold px-7 py-4 rounded-2xl shadow-etp-md transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Explore Buses
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/plan-trip"
              className="inline-flex items-center justify-center gap-2 etp-glass-dark border border-white/20 hover:bg-white/10 text-white font-semibold px-7 py-4 rounded-2xl transition-colors"
            >
              Plan with ETP AI
            </Link>
          </div>

          {/* Inline stat strip */}
          <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-2xl">
            {[
              { v: '120+', l: 'Bus Partners' },
              { v: '50K+', l: 'Happy Travellers' },
              { v: '4.7★', l: 'Average Rating' },
            ].map((s) => (
              <div
                key={s.l}
                className="etp-glass-dark border border-white/10 rounded-2xl px-4 py-4 backdrop-blur"
              >
                <p className="font-display text-2xl md:text-3xl font-bold text-white">{s.v}</p>
                <p className="text-[11px] text-ink-300 mt-1 font-medium uppercase tracking-wider">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 etp-glass-dark backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {trustItems.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-etp-200" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white leading-tight">{b.title}</p>
                    <p className="text-[11px] text-ink-300 leading-tight">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}