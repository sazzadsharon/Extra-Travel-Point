'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Calendar,
  Users,
  ArrowRight,
  Sparkles,
  Bus,
  Plane,
  Hotel,
  Car,
  Compass,
  Palmtree,
} from 'lucide-react';

type ServiceId = 'bus' | 'flight' | 'hotel' | 'car' | 'activities';

const services: { id: ServiceId; label: string; Icon: React.ElementType }[] = [
  { id: 'bus', label: 'Bus', Icon: Bus },
  { id: 'flight', label: 'Flight', Icon: Plane },
  { id: 'hotel', label: 'Hotel', Icon: Hotel },
  { id: 'car', label: 'Car', Icon: Car },
  { id: 'activities', label: 'Activities', Icon: Compass },
];

const cities = [
  'Dhaka',
  'Chattogram',
  "Cox's Bazar",
  'Sylhet',
  'Khulna',
  'Rajshahi',
  'Barisal',
  'Kuakata',
  'Sundarbans',
  'Srimangal',
  'Saint Martin',
  'Bandarban',
  'Sajek',
];

const liveServices: ServiceId[] = ['bus', 'hotel'];

export default function BookingSearchCard() {
  const router = useRouter();
  const [active, setActive] = useState<ServiceId>('bus');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [travelers, setTravelers] = useState(1);

  const isLive = liveServices.includes(active);
  const ActiveIcon = services.find((s) => s.id === active)?.Icon || Bus;

  const handleSearch = () => {
    if (active === 'bus') {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (date) p.set('date', date);
      router.push(`/transport/bus${p.toString() ? `?${p.toString()}` : ''}`);
    } else if (active === 'hotel') {
      router.push('/destinations');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto -mt-32 md:-mt-36 relative z-20 px-4 sm:px-6">
      <div className="bg-white rounded-3xl shadow-etp-lg border border-ink-100 overflow-hidden animate-fade-in-up">
        {/* Service tabs */}
        <div className="flex items-stretch overflow-x-auto scrollbar-hide border-b border-ink-100 bg-ink-50/50">
          {services.map((s) => {
            const isSelected = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-4 text-sm font-semibold transition-all relative ${
                  isSelected
                    ? 'text-etp-700 bg-white'
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <s.Icon className="w-4 h-4" />
                {s.label}
                {isSelected && (
                  <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-gradient-to-r from-etp-600 to-indigo-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <div className="p-5 md:p-7">
          {isLive ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
              {/* From */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-[0.16em] mb-2">
                  From
                </label>
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white border border-ink-200 rounded-xl text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-etp-500 focus:border-transparent cursor-pointer hover:border-ink-300 transition-colors"
                >
                  <option value="">Select origin</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* To */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-[0.16em] mb-2">
                  To
                </label>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white border border-ink-200 rounded-xl text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-etp-500 focus:border-transparent cursor-pointer hover:border-ink-300 transition-colors"
                >
                  <option value="">Select destination</option>
                  {cities.filter((c) => c !== from).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-[0.16em] mb-2">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-3.5 py-3 bg-white border border-ink-200 rounded-xl text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-etp-500 focus:border-transparent hover:border-ink-300 transition-colors"
                  />
                </div>
              </div>

              {/* Travelers */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-ink-500 uppercase tracking-[0.16em] mb-2">
                  Travelers
                </label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <select
                    value={travelers}
                    onChange={(e) => setTravelers(parseInt(e.target.value))}
                    className="w-full pl-10 pr-3.5 py-3 bg-white border border-ink-200 rounded-xl text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-etp-500 focus:border-transparent cursor-pointer hover:border-ink-300 transition-colors"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Traveler{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search button (full width on mobile) */}
              <div className="md:col-span-12 mt-2">
                <button
                  onClick={handleSearch}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-etp-700 to-indigo-700 hover:from-etp-800 hover:to-indigo-800 text-white font-semibold px-8 py-3.5 rounded-xl shadow-etp-md transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <ActiveIcon className="w-4 h-4" />
                  Search {services.find((s) => s.id === active)?.label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 bg-gradient-to-r from-etp-50 to-indigo-50 border border-etp-100 rounded-2xl p-5">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border border-etp-100">
                <Sparkles className="w-5 h-5 text-etp-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink-900 mb-1">
                  {services.find((s) => s.id === active)?.label} booking is on the way
                </p>
                <p className="text-sm text-ink-600 leading-relaxed">
                  Our {services.find((s) => s.id === active)?.label.toLowerCase()} network across
                  Bangladesh is being prepared. You can already book buses and curated hotel
                  packages today.
                </p>
              </div>
              <button
                disabled
                className="hidden sm:inline-flex items-center gap-2 bg-ink-100 text-ink-400 px-5 py-3 rounded-xl text-sm font-semibold cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
          )}
        </div>

        {/* Quick strip */}
        <div className="px-5 md:px-7 pb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <Palmtree className="w-3.5 h-3.5 text-etp-500" />
            Popular: Dhaka → Cox&apos;s Bazar
          </span>
          <span className="text-ink-300">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-etp-500" />
            Earn 2× ETP Points today
          </span>
          <span className="text-ink-300">•</span>
          <span>Free cancellation on most bookings</span>
        </div>
      </div>
    </div>
  );
}