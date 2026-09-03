'use client';

import Link from 'next/link';
import { Plane, Hotel, Bus, Train, Palmtree, Car, Compass, UtensilsCrossed } from 'lucide-react';
import { categories } from '@/data/mockData';

const iconMap: Record<string, React.ElementType> = {
  Plane,
  Hotel,
  Bus,
  Train,
  Palmtree,
  Car,
  Compass,
  UtensilsCrossed,
};

export default function CategorySection() {
  const activeCategories = categories.filter((c) => !c.comingSoon);
  const soonCount = categories.filter((c) => c.comingSoon).length;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
            Explore by Category
          </h2>
          <span className="text-sm text-gray-500">
            {activeCategories.length} live · {soonCount} coming soon
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((category) => {
            const Icon = iconMap[category.icon] || Compass;
            const card = (
              <div
                key={category.id}
                className={`group flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                  category.comingSoon
                    ? 'bg-gray-50 border-gray-100 opacity-70 cursor-not-allowed'
                    : 'bg-gray-50 hover:bg-primary-50 border-transparent hover:border-primary-100 hover:shadow-lg hover:shadow-primary-100/50 hover:-translate-y-1'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${
                    category.comingSoon
                      ? 'bg-white'
                      : 'bg-white group-hover:shadow-md group-hover:scale-110'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 transition-colors ${
                      category.comingSoon
                        ? 'text-gray-300'
                        : 'text-gray-600 group-hover:text-primary-600'
                    }`}
                  />
                </div>
                <span
                  className={`text-sm font-medium text-center leading-tight ${
                    category.comingSoon ? 'text-gray-400' : 'text-gray-700 group-hover:text-primary-700'
                  }`}
                >
                  {category.name}
                </span>
                {category.comingSoon ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    Soon
                  </span>
                ) : (
                  <span className="text-xs text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Book Now
                  </span>
                )}
              </div>
            );

            return category.href ? (
              <Link
                key={category.id}
                href={category.href}
                className="group flex flex-col items-center gap-3"
              >
                {card}
              </Link>
            ) : (
              <div key={category.id}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}