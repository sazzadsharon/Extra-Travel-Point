'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Star, Sun, Clock, Navigation, Filter } from 'lucide-react';
import Navbar from '../../components/layout/navbar';
import Footer from '../../components/layout/footer';
import { useDestinations } from '../../hooks/useDestinations';

const popularDestinations = [
  { id: 1, name: 'Cox\'s Bazar', category: 'Beach', rating: 4.7, image: '🏖️', description: 'World\'s longest natural sea beach' },
  { id: 2, name: 'Sundarbans', category: 'Nature', rating: 4.8, image: '🌿', description: 'Largest mangrove forest, UNESCO World Heritage' },
  { id: 3, name: 'Srimangal', category: 'Tea Gardens', rating: 4.6, image: '🍵', description: 'Tea capital of Bangladesh' },
  { id: 4, name: 'Saint Martin', category: 'Island', rating: 4.9, image: '🏝️', description: 'Only coral island in Bangladesh' },
  { id: 5, name: 'Bandarban', category: 'Hills', rating: 4.7, image: '⛰️', description: 'Hill district with scenic beauty' },
  { id: 6, name: 'Kuakata', category: 'Beach', rating: 4.5, image: '🌅', description: 'Land of sunrise and sunset over the sea' },
  { id: 7, name: 'Jaflong', category: 'Nature', rating: 4.6, image: '💎', description: 'Stone collection area near India border' },
  { id: 8, name: 'Ratargul', category: 'Forest', rating: 4.5, image: '🌊', description: 'Freshwater swamp forest' },
  { id: 9, name: 'Sajek Valley', category: 'Hills', rating: 4.8, image: '☁️', description: 'Queen of hills above the clouds' },
];

const categories = ['All', 'Beach', 'Nature', 'Hills', 'Island', 'Tea Gardens', 'Forest'];

export default function DestinationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const { guide, isLoading, error, fetchGuide } = useDestinations();

  useEffect(() => {
    fetchGuide('Cox\'s Bazar');
  }, [fetchGuide]);

  const handleDestinationClick = useCallback((name: string) => {
    setSelectedDestination(name);
    fetchGuide(name);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }, [fetchGuide]);

  const filteredDestinations = popularDestinations.filter((dest) => {
    const matchesSearch = dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || dest.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Explore Destinations</h1>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Discover the most beautiful places in Bangladesh
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search destinations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Destination Guide */}
        {selectedDestination && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ) : error ? (
                <p className="text-red-600">{error}</p>
              ) : guide ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{guide.destination}</h2>
                    <p className="text-gray-600">{guide.overview}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1 text-amber-600">
                      <Sun className="w-4 h-4" />
                      <span>{guide.currentWeather.tempC}°C, {guide.currentWeather.condition}</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <Clock className="w-4 h-4" />
                      <span>Best time: {guide.bestTimeToVisit}</span>
                    </div>
                  </div>

                  {guide.topAttractions.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Top Attractions</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {guide.topAttractions.map((attraction) => (
                          <div key={attraction.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{attraction.name}</span>
                            <span className="ml-auto flex items-center gap-1 text-xs text-amber-600">
                              <Star className="w-3 h-3 fill-current" />
                              {attraction.rating}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {guide.travelTips.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Travel Tips</h3>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {guide.travelTips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <a
                    href="/transport"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Book Travel to {guide.destination}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Destinations Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Popular Destinations
            </h2>
            <span className="text-sm text-gray-500">{filteredDestinations.length} destinations</span>
          </div>

          {filteredDestinations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDestinations.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => handleDestinationClick(dest.name)}
                  className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-blue-300 transition-all ${
                    selectedDestination === dest.name ? 'ring-2 ring-blue-500 border-blue-500' : ''
                  }`}
                >
                  <div className="text-4xl mb-4">{dest.image}</div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{dest.name}</h3>
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <Star className="w-4 h-4 fill-current" />
                      {dest.rating}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{dest.description}</p>
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {dest.category}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No destinations found</h3>
              <p className="text-gray-600">Try adjusting your search or filter</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
