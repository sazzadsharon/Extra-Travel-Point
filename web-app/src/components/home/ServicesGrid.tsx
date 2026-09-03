'use client';

import Link from 'next/link';
import { Bus, Plane, Hotel, Car, Compass, UtensilsCrossed, ArrowUpRight } from 'lucide-react';

const services = [
  {
    id: 'bus',
    name: 'Bus',
    desc: '120+ verified operators across Bangladesh',
    Icon: Bus,
    href: '/transport/bus',
    accent: 'from-etp-600 to-indigo-700',
    live: true,
  },
  {
    id: 'flight',
    name: 'Flights',
    desc: 'Domestic & international routes coming soon',
    Icon: Plane,
    href: '#',
    accent: 'from-indigo-600 to-violet-700',
    live: false,
  },
  {
    id: 'hotel',
    name: 'Hotels',
    desc: 'Hand-picked stays from Cox\'s Bazar to Sajek',
    Icon: Hotel,
    href: '/destinations',
    accent: 'from-violet-600 to-fuchsia-700',
    live: true,
  },
  {
    id: 'car',
    name: 'Cars',
    desc: 'Self-drive and chauffeur rentals across cities',
    Icon: Car,
    href: '#',
    accent: 'from-blue-600 to-cyan-700',
    live: false,
  },
  {
    id: 'activities',
    name: 'Activities',
    desc: 'Curated tours, hikes and cultural experiences',
    Icon: Compass,
    href: '/plan-trip',
    accent: 'from-emerald-600 to-teal-700',
    live: true,
  },
  {
    id: 'restaurants',
    name: 'Restaurants',
    desc: 'Reserve the best tables along your route',
    Icon: UtensilsCrossed,
    href: '#',
    accent: 'from-rose-600 to-pink-700',
    live: false,
  },
];

export default function ServicesGrid() {
  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.22em] text-etp-600 mb-3">
            Everything for your journey
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-ink-900 leading-tight tracking-tight">
            Six services. <br className="hidden sm:block" />
            <span className="text-gradient bg-gradient-to-r from-etp-700 via-indigo-700 to-violet-700">
              One seamless app.
            </span>
          </h2>
          <p className="text-ink-600 mt-4 text-base md:text-lg leading-relaxed">
            From city buses to hill resorts — book every part of your trip with ETP,
            with a single sign-in and one unified wallet.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => {
            const Card = (
              <div className="group relative h-full bg-white rounded-3xl overflow-hidden p-7 border border-ink-100 hover:border-etp-200 shadow-etp-sm hover:shadow-etp-md transition-all duration-500 hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.accent} flex items-center justify-center shadow-etp-sm`}>
                  <s.Icon className="w-6 h-6 text-white" />
                </div>
                <div className="mt-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl font-bold text-ink-900 tracking-tight">
                      {s.name}
                    </h3>
                    <p className="text-sm text-ink-600 mt-1.5 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-ink-300 group-hover:text-etp-600 group-hover:rotate-12 transition-all flex-shrink-0" />
                </div>
                <div className="mt-6 flex items-center gap-2">
                  {s.live ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Live now
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 bg-ink-50 px-2.5 py-1 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${s.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
            );

            return s.live ? (
              <Link key={s.id} href={s.href} className="block h-full">
                {Card}
              </Link>
            ) : (
              <div key={s.id} className="h-full">
                {Card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}