'use client';

import { useState, useCallback } from 'react';
import { MapPin, Calendar, Wallet, Users, Sparkles, ChevronRight, Bus, Hotel, Utensils, AlertCircle } from 'lucide-react';
import Navbar from '../../components/layout/navbar';
import Footer from '../../components/layout/footer';
import { useTripPlanner } from '../../hooks/useTripPlanner';

const cities = [
  'Dhaka', 'Chittagong', 'Cox\'s Bazar', 'Sylhet', 'Khulna', 'Rajshahi', 'Barisal', 'Kuakata', 'Sundarbans', 'Srimangal', 'Saint Martin', 'Bandarban'
];

export default function PlanTripPage() {
  const [origin, setOrigin] = useState('Dhaka');
  const [destination, setDestination] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [maxBudget, setMaxBudget] = useState(5000);
  const [travelers, setTravelers] = useState(1);
  const { plan, isLoading, error, generatePlan } = useTripPlanner();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;
    generatePlan({
      origin,
      destination,
      durationDays,
      maxBudget,
      prompt: `Plan a ${durationDays}-day trip from ${origin} to ${destination} for ${travelers} traveler(s) within BDT ${maxBudget}`,
    });
  }, [origin, destination, durationDays, maxBudget, travelers, generatePlan]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-16">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Plan Your Trip</h1>
            <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
              Get a personalized AI-powered itinerary with budget breakdown
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Trip Planning Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    From (Origin)
                  </label>
                  <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select origin city</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    To (Destination)
                  </label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select destination</option>
                    {cities.filter(c => c !== origin).map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Wallet className="inline w-4 h-4 mr-1" />
                    Budget (BDT)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={500000}
                    step={500}
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(parseInt(e.target.value) || 1000)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="inline w-4 h-4 mr-1" />
                    Travelers
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={travelers}
                    onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!origin || !destination || isLoading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Trip Plan
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <p className="text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          {/* Trip Plan Result */}
          {plan && !isLoading && (
            <div className="space-y-6">
              {/* AI Message */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">{plan.aiMessage}</p>
                </div>
              </div>

              {/* Trip Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Trip Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Route</p>
                    <p className="text-sm font-medium">{plan.origin} → {plan.destination}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="text-sm font-medium">{plan.durationDays} Days</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Wallet className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Budget</p>
                    <p className="text-sm font-medium">BDT {plan.totalBudget.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Users className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Travelers</p>
                    <p className="text-sm font-medium">{travelers}</p>
                  </div>
                </div>
              </div>

              {/* Budget Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Budget Breakdown</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Bus className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Transport</p>
                      <p className="text-sm font-medium">BDT {plan.budgetBreakdown.busTicket.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Hotel className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500">Hotel</p>
                      <p className="text-sm font-medium">BDT {plan.budgetBreakdown.hotelCost.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                    <Utensils className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-xs text-gray-500">Food</p>
                      <p className="text-sm font-medium">BDT {plan.budgetBreakdown.foodEstimate.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-500">Local Transport</p>
                      <p className="text-sm font-medium">BDT {plan.budgetBreakdown.localTransport.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-xs text-gray-500">Emergency</p>
                      <p className="text-sm font-medium">BDT {plan.budgetBreakdown.emergencyExtra.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Itinerary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Day-by-Day Itinerary</h2>
                <div className="space-y-4">
                  {plan.dayByDayItinerary.map((day) => (
                    <div key={day.day} className="border-l-4 border-indigo-500 pl-4">
                      <h3 className="font-semibold text-gray-900">
                        Day {day.day}: {day.title}
                      </h3>
                      <ul className="mt-2 space-y-1">
                        {day.activities.map((activity, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                            <ChevronRight className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Booking */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Suggested Booking</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Transport</p>
                    <p className="font-medium text-gray-900">{plan.suggestedBooking.transport.type}</p>
                    <p className="text-sm text-blue-600">BDT {plan.suggestedBooking.transport.fare.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Hotel</p>
                    <p className="font-medium text-gray-900">{plan.suggestedBooking.hotel.name}</p>
                    <p className="text-sm text-green-600">BDT {plan.suggestedBooking.hotel.pricePerNight.toLocaleString()}/night</p>
                  </div>
                </div>
                <p className="text-sm text-indigo-600 font-medium">{plan.suggestedBooking.recommendedAction}</p>
              </div>

              {/* Alternative Plan */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{plan.alternativePlan.title}</h2>
                <p className="text-sm text-gray-600 mb-3">{plan.alternativePlan.details}</p>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-amber-700">BDT {plan.alternativePlan.totalCost.toLocaleString()}</span>
                  <span className="text-sm text-green-600 font-medium">Save BDT {plan.alternativePlan.savings.toLocaleString()}</span>
                </div>
              </div>

              {/* Weather */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Weather Forecast</h2>
                <p className="text-gray-600">{plan.weatherForecast.condition}, {plan.weatherForecast.temperatureC}°C</p>
                <p className="text-sm text-indigo-600 mt-1">{plan.weatherForecast.recommendation}</p>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/transport"
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <Bus className="w-4 h-4" />
                  Book Transport
                </a>
                <a
                  href="/destinations"
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Explore Destinations
                </a>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!plan && !isLoading && !error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to plan your trip?</h3>
              <p className="text-gray-600">Fill in the form above and get a personalized itinerary</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
