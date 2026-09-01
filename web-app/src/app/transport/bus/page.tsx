'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Calendar, X, Bus as BusIcon } from 'lucide-react';
import { useBuses } from '../../../hooks/useBuses';
import BusMvpCard from '../../../components/transport/BusMvpCard';

const cities = [
  'Dhaka',
  'Chittagong',
  "Cox's Bazar",
  'Sylhet',
  'Khulna',
  'Rajshahi',
  'Barisal'
];

export default function BusListPage() {
  const router = useRouter();
  const { buses, isLoading, error, fetchBuses } = useBuses();
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [travelDate, setTravelDate] = useState('');

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTravelDate(tomorrow.toISOString().split('T')[0]);
    fetchBuses();
  }, [fetchBuses]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      fetchBuses({
        fromCity: fromCity || undefined,
        toCity: toCity || undefined,
        date: travelDate || undefined
      });
    },
    [fromCity, toCity, travelDate, fetchBuses]
  );

  const handleClear = useCallback(() => {
    setFromCity('');
    setToCity('');
    setTravelDate('');
    fetchBuses();
  }, [fetchBuses]);

  const getAvailableCities = (): string[] =>
    cities.filter(c => ![fromCity, toCity].includes(c));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bus Booking</h1>
            <p className="text-gray-600">
              Search and reserve seats on verified bus operators across Bangladesh.
            </p>
          </div>
          <button
            onClick={() => router.push('/transport')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Other transport (car, microbus, airport)
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  From
                </label>
                <select
                  value={fromCity}
                  onChange={e => setFromCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any departure city</option>
                  {cities.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  To
                </label>
                <select
                  value={toCity}
                  onChange={e => setToCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any destination</option>
                  {getAvailableCities().map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Travel Date
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={e => setTravelDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search Buses
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Available Buses {buses.length > 0 && `(${buses.length})`}
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : buses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buses.map((b, i) => (
              <BusMvpCard key={b.id} bus={b} travelDate={travelDate} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BusIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No buses found</h3>
            <p className="text-gray-600">
              Try a different date or clear filters to see all available buses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}