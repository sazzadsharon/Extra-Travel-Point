'use client';

import { ShieldCheck, Lock, Headphones, Gift } from 'lucide-react';
import { benefits } from '@/data/mockData';

const iconMap: Record<string, React.ElementType> = {
  ShieldCheck,
  Lock,
  Headphones,
  Gift,
};

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  blue: { bg: 'bg-primary-50', text: 'text-primary-600', ring: 'ring-primary-100' },
  green: { bg: 'bg-primary-100', text: 'text-primary-700', ring: 'ring-primary-200' },
  purple: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  amber: { bg: 'bg-accent-50', text: 'text-accent-600', ring: 'ring-accent-100' },
};

export default function WhyTravelWithETP() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Why Travel With ETP?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Built for Bangladesh — trusted journeys, instant QR tickets and rewards that actually
            come back to you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit) => {
            const Icon = iconMap[benefit.icon] || ShieldCheck;
            const colors = colorMap[benefit.color] || colorMap.blue;
            return (
              <div
                key={benefit.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-primary-100 hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className={`w-14 h-14 ${colors.bg} ${colors.text} rounded-2xl flex items-center justify-center mb-5 ring-4 ${colors.ring}`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}