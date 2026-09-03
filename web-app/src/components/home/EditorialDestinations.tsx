'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Star } from 'lucide-react';

const destinations = [
  {
    name: "Cox's Bazar",
    region: 'World\'s longest sea beach',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=1400&fit=crop',
    rating: 4.8,
    href: '/destinations',
  },
  {
    name: 'Sylhet',
    region: 'Tea gardens & rolling hills',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&h=1400&fit=crop',
    rating: 4.8,
    href: '/destinations',
  },
  {
    name: 'Sajek Valley',
    region: 'Queen of the hills above the clouds',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=1400&fit=crop',
    rating: 4.7,
    href: '/destinations',
  },
  {
    name: 'Bandarban',
    region: 'Mountains, rivers and indigenous culture',
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&h=1400&fit=crop',
    rating: 4.7,
    href: '/destinations',
  },
];

export default function EditorialDestinations() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.22em] text-etp-600 mb-3">
              Editorial destinations
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-ink-900 leading-[1.05] tracking-tight">
              Discover <span className="text-gradient bg-gradient-to-r from-etp-700 to-indigo-700">Bangladesh.</span>
            </h2>
            <p className="text-ink-600 mt-4 text-base md:text-lg leading-relaxed">
              Quiet beaches, ancient forests and emerald hills — curated journeys
              across the country&apos;s most unforgettable places.
            </p>
          </div>
          <Link
            href="/destinations"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-900 hover:text-etp-700 transition-colors self-start md:self-end"
          >
            View all destinations
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {destinations.map((d, idx) => (
            <Link
              key={d.name}
              href={d.href}
              className="group relative h-[420px] md:h-[480px] rounded-3xl overflow-hidden bg-ink-100 shadow-etp-sm hover:shadow-etp-lg transition-all duration-500 hover:-translate-y-1"
            >
              <Image
                src={d.image}
                alt={d.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-1000"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                priority={idx === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />

              <div className="absolute top-4 right-4 etp-glass-dark border border-white/20 rounded-full px-2.5 py-1 flex items-center gap-1 text-xs text-white font-semibold">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {d.rating}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-[10px] uppercase tracking-[0.22em] text-etp-200 font-semibold">
                  {String(idx + 1).padStart(2, '0')} / Bangladesh
                </p>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-white mt-2 tracking-tight">
                  {d.name}
                </h3>
                <p className="text-sm text-ink-200 mt-1.5 leading-relaxed">
                  {d.region}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 group-hover:text-white">
                  Explore
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}