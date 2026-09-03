'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { topDeals } from '@/data/mockData';

const categoryStyles: Record<string, string> = {
  Bus: 'bg-primary-50 text-primary-700',
  Hotel: 'bg-accent-50 text-accent-700',
  Tour: 'bg-violet-50 text-violet-700',
};

export default function TopDeals() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
              Top Deals For You
            </h2>
            <p className="text-gray-500 mt-1">
              Hand-picked Bangladesh journeys at the best prices
            </p>
          </div>
          <Link
            href="/destinations"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            View all deals
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topDeals.map((deal) => (
            <Link
              key={deal.id}
              href={deal.href || '/transport/bus'}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-primary-900/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={deal.image}
                  alt={deal.route}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  <span className="inline-block px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg shadow-sm">
                    {deal.discount}% OFF
                  </span>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      categoryStyles[deal.category] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {deal.category}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 mb-1.5 group-hover:text-primary-700 transition-colors">
                  {deal.route}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">৳{deal.price.toLocaleString()}</span>
                  <span className="text-sm text-gray-400 line-through">
                    ৳{deal.originalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 inline-flex items-center text-sm font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Book now
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}