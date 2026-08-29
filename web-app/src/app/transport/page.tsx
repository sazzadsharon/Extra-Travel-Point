'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MapPin, Calendar, Users, X, Bus as BusIcon, Car, Plane, Train } from 'lucide-react';
import BusCard from '../../components/transport/BusCard';
import { useTransports } from '../../hooks/useTransports';
import type { Vehicle, SearchFilters } from '../../types/transport';

const cities = [
  'Dhaka', 'Chittagong', 'Cox\'s Bazar', 'Sylhet', 'Khulna', 'Rajshahi', 'Barisal'
];

export default function TransportPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { vehicles, isLoading, error, fetchVehicles } = useTransports();
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [filterCity, setFilterCity] = useState('');

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    setTravelDate(tomorrow.toISOString().split('T')[0]);
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (filterCity) {
      fetchVehicles(undefined, filterCity);
    }
  }, [filterCity, fetchVehicles]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (fromCity && toCity && travelDate) {
      fetchVehicles(undefined, filterCity || undefined);
    }
  }, [fromCity, toCity, travelDate, filterCity, fetchVehicles]);

  const handleClearFilters = useCallback(() => {
    setFromCity('');
    setToCity('');
    setTravelDate('');
    setFilterCity('');
    fetchVehicles();
  }, [fetchVehicles]);

  const getAvailableCities = (): string[] => {
    const selected = [fromCity, toCity].filter(Boolean) as string[];
    return cities.filter(city => !selected.includes(city));
  };

  const getVehicleIcon = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('microbus')) return Car;
    if (t.includes('airport')) return Plane;
    if (t.includes('bike')) return Train;
    return BusIcon;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Book Your Travel</h1>
          <p className="text-gray-600">Find and book bus, car, and other transport services</p>
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
                  onChange={(e) => setFromCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select departure city</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
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
                  onChange={(e) => setToCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select destination city</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
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
                  onChange={(e) => setTravelDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filter by City
                {filterCity && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                    {filterCity}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>

              <button
                type="submit"
                disabled={!fromCity || !toCity || !travelDate || isLoading}
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
            </div>
          </form>

          {isFilterOpen && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by City (optional)
              </label>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Available Vehicles {vehicles.length > 0 && `(${vehicles.length})`}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Live data
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : vehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((bus: Vehicle, index: number) => (
              <BusCard key={bus.id} bus={bus} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No buses found</h3>
            <p className="text-gray-600 mb-4">
              {fromCity && toCity && travelDate
                ? 'Try different dates or cities'
                : 'Select departure city, destination city and travel date'}
            </p>
            {(fromCity || toCity || travelDate) && (
              <button
                onClick={handleClearFilters}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}