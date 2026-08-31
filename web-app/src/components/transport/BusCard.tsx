/**
 * BusCard component
 * Displays a single bus/vehicle in the search results list
 */
import Link from 'next/link';
import { Bus, Users, Clock, ArrowRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Vehicle } from '../../types/transport';

interface BusCardProps {
  bus: Vehicle;
  index?: number;
  fromCity?: string;
  toCity?: string;
  travelDate?: string;
}

export default function BusCard({ bus, index = 0, fromCity, toCity, travelDate }: BusCardProps) {
  // Default values for optional fields
  const baseFare = bus.baseFare ?? 0;
  const capacity = bus.capacity ?? 0;
  const city = bus.city ?? 'N/A';
  const type = bus.type ?? 'Vehicle';
  const model = bus.model ?? 'Standard';

  // For airport transfer, show fixed fare if available
  const fareDisplay = bus.fixedFare !== undefined ? `BDT ${bus.fixedFare}` : `BDT ${baseFare}`;
  const capacityDisplay = bus.capacity !== undefined ? String(bus.capacity) : 'N/A';
  const cityDisplay = bus.city ?? 'N/A';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{type}</h3>
              <p className="text-sm text-gray-500">{model}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">ID</p>
            <p className="text-xs font-mono text-gray-600">ETP-{String(bus.id).padStart(3, '0')}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Departure</p>
              <p className="font-medium">Scheduled</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Arrival</p>
              <p className="font-medium">Scheduled</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-400">Fare</p>
            <p className="font-bold text-gray-900">{fareDisplay}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Capacity</p>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-gray-400" />
              <p className="font-medium text-gray-700">{capacityDisplay}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400">City</p>
            <p className="font-medium text-gray-700 truncate">{cityDisplay}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-gray-700">4.5</span>
            <span className="text-xs text-gray-400">(128 reviews)</span>
          </div>
          <Link
            href={`/transport/${bus.id}?fromCity=${encodeURIComponent(fromCity || '')}&toCity=${encodeURIComponent(toCity || '')}&travelDate=${encodeURIComponent(travelDate || '')}`}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
          >
            View details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}