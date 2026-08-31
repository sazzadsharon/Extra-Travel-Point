'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, MapPin, Users, Shield, Star, CreditCard, Bus as BusIcon, Car, Plane, Train } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { API_CONFIG } from '../../../config/api';
import type { Vehicle } from '../../../types/transport';

interface Provider {
  id: number;
  businessName: string;
  category: string;
  description?: string;
  address: string;
  city?: string;
  phone?: string;
  rating: number;
  totalReviews: number;
  isVerified: boolean;
}

export default function TransportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const vehicleId = parseInt(params.id as string, 10);
  const fromCity = searchParams.get('fromCity') || '';
  const toCity = searchParams.get('toCity') || '';
  const selectedTravelDate = searchParams.get('travelDate') || '';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getVehicleIcon = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('microbus')) return Car;
    if (t.includes('airport')) return Plane;
    if (t.includes('bike')) return Train;
    return BusIcon;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const vehiclesRes = await axios.get<Vehicle[]>(`${API_CONFIG.API_BASE_URL}/transport/vehicles`);
        const foundVehicle = vehiclesRes.data.find(v => v.id === vehicleId);

        if (!foundVehicle) {
          setError('Vehicle not found');
          setIsLoading(false);
          return;
        }

        setVehicle(foundVehicle);

        const providerRes = await axios.get<Provider>(`${API_CONFIG.API_BASE_URL}/providers/2`);
        setProvider(providerRes.data);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load vehicle details');
      } finally {
        setIsLoading(false);
      }
    };

    if (vehicleId) {
      fetchData();
    }
  }, [vehicleId]);

  const handleContinue = () => {
    if (!vehicle) return;
    const travelDate = selectedTravelDate || new Date().toISOString().split('T')[0];
    const routeQuery = `fromCity=${encodeURIComponent(fromCity)}&toCity=${encodeURIComponent(toCity)}&travelDate=${encodeURIComponent(travelDate)}`;
    router.push(`/booking/seats?vehicleId=${vehicle.id}&providerId=${provider?.id || 2}&category=bus&${routeQuery}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="h-32 bg-gray-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[60vh]">
          <Link
            href="/transport"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <BusIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vehicle Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The requested vehicle could not be found'}</p>
          <Link
            href="/transport"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const baseFare = vehicle.baseFare ?? 0;
  const fareDisplay = vehicle.fixedFare !== undefined ? `BDT ${vehicle.fixedFare}` : `BDT ${baseFare}`;
  const capacity = vehicle.capacity ?? 0;
  const city = vehicle.city ?? 'N/A';
  const type = vehicle.type ?? 'Vehicle';
  const model = vehicle.model ?? 'Standard';
  const VehicleIcon = getVehicleIcon(type);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/transport"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 md:p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                  <VehicleIcon className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">{type}</h1>
                  <p className="text-blue-100 text-lg">{model}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-sm">
                      <MapPin className="w-3 h-3" />
                      {city}
                    </span>
                    {provider && (
                      <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-sm">
                        <Shield className="w-3 h-3" />
                        Verified Operator
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-200">VEHICLE ID</p>
                <p className="text-lg font-mono font-bold">ETP-{String(vehicle.id).padStart(3, '0')}</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-xl p-6">
                <div className="flex items-center gap-3 text-blue-700 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-700">Route</p>
                <p className="text-lg font-semibold text-gray-900">
                  {fromCity && toCity ? `${fromCity} → ${toCity}` : (vehicle.route || `${city} Route`)}
                </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-6">
                <div className="flex items-center gap-3 text-green-700 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-700">Departure</p>
                    <p className="text-lg font-semibold text-gray-900">06:00 AM</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 rounded-xl p-6">
                <div className="flex items-center gap-3 text-orange-700 mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-700">Arrival</p>
                    <p className="text-lg font-semibold text-gray-900">12:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  Vehicle Information
                </h3>
                <dl className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <dt className="text-sm text-gray-500">Vehicle Type</dt>
                    <dd className="text-sm font-medium text-gray-900">{type}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <dt className="text-sm text-gray-500">Model</dt>
                    <dd className="text-sm font-medium text-gray-900">{model}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <dt className="text-sm text-gray-500">Capacity</dt>
                    <dd className="text-sm font-medium text-gray-900">{capacity > 0 ? `${capacity} seats` : 'N/A'}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <dt className="text-sm text-gray-500">Base City</dt>
                    <dd className="text-sm font-medium text-gray-900">{city}</dd>
                  </div>
                  {vehicle.farePerKm && (
                    <div className="grid grid-cols-2 gap-3">
                      <dt className="text-sm text-gray-500">Fare per km</dt>
                      <dd className="text-sm font-medium text-gray-900">BDT {vehicle.farePerKm}/km</dd>
                    </div>
                  )}
                  {vehicle.fixedFare && (
                    <div className="grid grid-cols-2 gap-3">
                      <dt className="text-sm text-gray-500">Fixed Fare</dt>
                      <dd className="text-sm font-medium text-gray-900">BDT {vehicle.fixedFare}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {provider && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-gray-500" />
                    Operator Details
                  </h3>
                  <dl className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <dt className="text-sm text-gray-500">Company</dt>
                      <dd className="text-sm font-medium text-gray-900">{provider.businessName}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <dt className="text-sm text-gray-500">Category</dt>
                      <dd className="text-sm font-medium text-gray-900 capitalize">{provider.category}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <dt className="text-sm text-gray-500">Address</dt>
                      <dd className="text-sm font-medium text-gray-900">{provider.address}</dd>
                    </div>
                    {provider.city && (
                      <div className="grid grid-cols-2 gap-3">
                        <dt className="text-sm text-gray-500">City</dt>
                        <dd className="text-sm font-medium text-gray-900">{provider.city}</dd>
                      </div>
                    )}
                    {provider.phone && (
                      <div className="grid grid-cols-2 gap-3">
                        <dt className="text-sm text-gray-500">Contact</dt>
                        <dd className="text-sm font-medium text-gray-900">{provider.phone}</dd>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <dt className="text-sm text-gray-500">Rating</dt>
                      <dd className="text-sm font-medium text-gray-900 flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        {provider.rating} ({provider.totalReviews} reviews)
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-6 md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-500" />
                  Fare Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Base Fare</p>
                    <p className="text-2xl font-bold text-gray-900">{fareDisplay}</p>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Taxes & Fees</p>
                    <p className="text-2xl font-bold text-gray-900">Included</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 mb-1">Total Payable</p>
                    <p className="text-2xl font-bold text-blue-700">{fareDisplay}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={handleContinue}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
              >
                Continue to Seat Selection
                <CreditCard className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
