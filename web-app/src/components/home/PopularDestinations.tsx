'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MapPin, Star, ArrowRight } from 'lucide-react';
import { popularDestinations } from '@/data/mockData';

export default function PopularDestinations() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const toggleFavorite = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
              Popular Destinations
            </h2>
            <p className="text-gray-500 mt-1">Across the beauty of Bangladesh</p>
          </div>
          <Link
            href="/destinations"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            View all destinations
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularDestinations.map((destination) => (
            <Link
              key={destination.id}
              href={`/destinations?destination=${encodeURIComponent(destination.name)}`}
              className="group relative h-72 md:h-80 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <Image
                src={destination.image}
                alt={destination.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {destination.priceFrom && (
                <span className="absolute top-4 left-4 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-primary-700 text-xs font-bold rounded-lg">
                  From ৳{destination.priceFrom.toLocaleString()}
                </span>
              )}

              <button
                onClick={(e) => toggleFavorite(destination.id, e)}
                className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  favorites.has(destination.id)
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                }`}
                aria-label={favorites.has(destination.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`w-5 h-5 ${favorites.has(destination.id) ? 'fill-current' : ''}`} />
              </button>

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-accent-300" />
                  <span className="text-sm text-accent-200 font-medium">{destination.country}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-accent-200 transition-colors">
                  {destination.name}
                </h3>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-accent-400 fill-current" />
                  <span className="text-sm font-medium text-accent-400">{destination.rating}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}