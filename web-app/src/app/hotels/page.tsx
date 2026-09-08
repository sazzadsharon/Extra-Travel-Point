'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, MapPin, Star, Search, Hotel, Wifi, Car, Coffee, Users } from 'lucide-react';
import api from '../../lib/apiClient';

interface HotelCard {
  id: number;
  slug?: string | null;
  businessName: string;
  description?: string | null;
  address: string;
  city?: string | null;
  starRating?: number | null;
  rating: number;
  totalReviews: number;
  primaryImage?: string | null;
  amenities: string[];
  startingPrice: number;
  rooms: Array<{ id: number; name: string; type: string; price: number; capacity: number; adultCapacity?: number; childCapacity?: number }>;
}

interface SearchResponse {
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hotels: HotelCard[];
}

function amenityIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('wifi')) return <Wifi className="w-3 h-3" />;
  if (n.includes('parking') || n.includes('car')) return <Car className="w-3 h-3" />;
  if (n.includes('breakfast') || n.includes('restaurant') || n.includes('coffee')) return <Coffee className="w-3 h-3" />;
  return null;
}

export default function HotelsSearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading hotels…</div>}>
      <HotelsSearchContent />
    </Suspense>
  );
}

function HotelsSearchContent() {
  const params = useSearchParams();
  const [city, setCity] = useState(params.get('city') || '');
  const [checkIn, setCheckIn] = useState(params.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(params.get('checkOut') || '');
  const [guests, setGuests] = useState(params.get('guests') || '2');
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [hotels, setHotels] = useState<HotelCard[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (city) qp.append('city', city);
      if (sort) qp.append('sort', sort);
      if (checkIn) qp.append('checkIn', checkIn);
      if (checkOut) qp.append('checkOut', checkOut);
      if (guests) qp.append('guests', guests);
      qp.append('page', String(page));
      qp.append('limit', '12');
      const res = await api.get<SearchResponse>(`/hotels/search?${qp.toString()}`);
      setHotels(res.data.hotels || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load hotels');
      setHotels([]);
    } finally {
      setIsLoading(false);
    }
  }, [city, checkIn, checkOut, guests, sort, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-etp-100 text-etp-700 px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Hotel className="w-3.5 h-3.5" /> Hotels & Stays
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Find your perfect stay</h1>
          <p className="text-slate-500 max-w-xl mx-auto">Discover verified hotels and local guest houses across the country.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-4 sm:p-5 mb-8 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Destination / City"
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-etp-500 focus:border-etp-500"
            />
          </div>
          <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl" />
          <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl" />
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="number" min="1" value={guests} onChange={e => setGuests(e.target.value)} placeholder="Guests" className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{total} hotel{total === 1 ? '' : 's'} found</p>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm">
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>
        ) : hotels.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-etp-50 mb-4">
              <Hotel className="w-8 h-8 text-etp-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No hotels found</h3>
            <p className="text-slate-500">Try a different destination or relax your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {hotels.map(h => (
              <Link key={h.id} href={`/hotels/${h.id}`} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden hover:shadow-lift transition-all">
                <div className="aspect-[4/3] bg-gradient-to-br from-etp-100 to-violet-100 relative">
                  {h.primaryImage ? (
                    <img src={h.primaryImage} alt={h.businessName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-etp-300">
                      <Hotel className="w-16 h-16" />
                    </div>
                  )}
                  {h.starRating ? (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-0.5">
                      {Array.from({ length: h.starRating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                    </div>
                  ) : null}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-900 text-lg mb-1 line-clamp-1">{h.businessName}</h3>
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {h.city || h.address}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                    {h.rating > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                        <Star className="w-3 h-3 fill-current" /> {h.rating.toFixed(1)} ({h.totalReviews})
                      </span>
                    ) : <span className="text-slate-400">New</span>}
                  </div>
                  {h.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {h.amenities.slice(0, 3).map(a => (
                        <span key={a} className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {amenityIcon(a)} {a}
                        </span>
                      ))}
                      {h.amenities.length > 3 && <span className="text-[10px] text-slate-400">+{h.amenities.length - 3}</span>}
                    </div>
                  )}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">Starting from</p>
                      <p className="text-lg font-bold text-etp-700">BDT {h.startingPrice.toLocaleString()}<span className="text-xs font-normal text-slate-500"> /night</span></p>
                    </div>
                    <span className="text-xs text-etp-600 font-medium">View →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 rounded-lg text-sm ${p === page ? 'bg-etp-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
