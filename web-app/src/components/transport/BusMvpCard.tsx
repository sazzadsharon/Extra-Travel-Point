'use client';

import Link from 'next/link';
import { Bus as BusIcon, Users, Clock, ArrowRight, Star, Shield, MapPin } from 'lucide-react';
import type { Bus } from '../../types/transport';

interface BusCardProps {
  bus: Bus;
  travelDate?: string;
  index?: number;
}

export default function BusMvpCard({ bus, travelDate, index = 0 }: BusCardProps) {
  const nextSlot = bus.availability && bus.availability.length > 0 ? bus.availability[0] : null;

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all overflow-hidden"
      data-index={index}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BusIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">{bus.name}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {bus.provider?.businessName ?? 'Operator'}
                {bus.provider?.isVerified && (
                  <span className="text-green-600 font-medium">· Verified</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">BUS ID</p>
            <p className="text-xs font-mono text-gray-600">ETP-BUS-{String(bus.id).padStart(4, '0')}</p>
          </div>
        </div>

        {bus.route && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{bus.route}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Departure</p>
              <p className="font-medium">{nextSlot?.startTime ?? 'Scheduled'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Arrival</p>
              <p className="font-medium">{nextSlot?.endTime ?? 'Scheduled'}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-400">Fare / Seat</p>
            <p className="font-bold text-gray-900">BDT {bus.price}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Capacity</p>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-gray-400" />
              <p className="font-medium text-gray-700">{bus.capacity}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">From</p>
            <p className="font-medium text-gray-700 truncate">{bus.provider?.city ?? 'N/A'}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-gray-700">
              {(bus.provider?.rating ?? 0).toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">({bus.provider?.totalReviews ?? 0})</span>
          </div>
          <Link
            href={`/transport/bus/${bus.id}${travelDate ? `?travelDate=${encodeURIComponent(travelDate)}` : ''}`}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
          >
            View Details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
