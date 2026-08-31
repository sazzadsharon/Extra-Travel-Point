'use client';

import { useState, FormEvent } from 'react';
import { MapPin, Calendar, Users, DollarSign, MessageSquare, Loader2, AlertCircle, Sparkles, Bus, Hotel, Utensils, Plane, Shield, Sun } from 'lucide-react';
import { API_CONFIG } from '../../config/api';
import Navbar from '../../components/layout/navbar';
import Footer from '../../components/layout/footer';

interface BudgetBreakdown {
  busTicket: number;
  hotelCost: number;
  foodEstimate: number;
  localTransport: number;
  emergencyExtra: number;
  totalCalculated: number;
}

interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
}

interface WeatherForecast {
  condition: string;
  temperatureC: number;
  recommendation: string;
}

interface SuggestedBooking {
  transport: { type: string; fare: number };
  hotel: { name: string; pricePerNight: number };
  recommendedAction: string;
}

interface AlternativePlan {
  title: string;
  totalCost: number;
  savings: number;
  details: string;
}

interface AIResponse {
  query: string;
  destination: string;
  origin: string;
  durationDays: number;
  totalBudget: number;
  budgetBreakdown: BudgetBreakdown;
  dayByDayItinerary: ItineraryDay[];
  weatherForecast: WeatherForecast;
  suggestedBooking: SuggestedBooking;
  alternativePlan: AlternativePlan;
  aiMessage: string;
}

const popularDestinations = [
  "Cox's Bazar",
  'Kuakata',
  'Sundarbans',
  'Srimangal',
  'Bandarban',
  'Rangamati',
  'Jaflong',
  'Saint Martin',
];

export default function AIAssistantPage() {
  const [destination, setDestination] = useState('');
  const [origin, setOrigin] = useState('Dhaka');
  const [budget, setBudget] = useState('10000');
  const [days, setDays] = useState('3');
  const [travelers, setTravelers] = useState('2');
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AIResponse | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${API_CONFIG.API_BASE_URL}/ai/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination: destination || undefined,
          origin: origin || undefined,
          maxBudget: budget ? Number(budget) : undefined,
          durationDays: days ? Number(days) : undefined,
          prompt: notes || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const data: AIResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Travel Assistant</h1>
          <p className="text-gray-600">
            Plan your perfect trip with AI-powered recommendations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="origin" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                From
              </label>
              <input
                id="origin"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Dhaka"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Destination
              </label>
              <input
                id="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Cox's Bazar"
                list="destinations-list"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <datalist id="destinations-list">
                {popularDestinations.map((dest) => (
                  <option key={dest} value={dest} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline w-4 h-4 mr-1" />
                Budget (৳)
              </label>
              <input
                id="budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="10000"
                min="1000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Days
              </label>
              <input
                id="days"
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="3"
                min="1"
                max="30"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="travelers" className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="inline w-4 h-4 mr-1" />
                Travelers
              </label>
              <input
                id="travelers"
                type="number"
                value={travelers}
                onChange={(e) => setTravelers(e.target.value)}
                placeholder="2"
                min="1"
                max="50"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="inline w-4 h-4 mr-1" />
              Notes / Preferences (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="চাই কম খরচে সমুদ্র ভ্রমণ..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Planning your trip...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Plan My Trip
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Error</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {response && (
          <div className="space-y-6">
            {response.aiMessage && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  <div>
                    <h2 className="font-semibold text-gray-900 mb-2">AI Recommendation</h2>
                    <p className="text-gray-700 whitespace-pre-wrap">{response.aiMessage}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Budget Breakdown
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                    <Bus className="w-4 h-4" />
                    Bus Ticket
                  </div>
                  <div className="font-semibold text-gray-900">{formatCurrency(response.budgetBreakdown.busTicket)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                    <Hotel className="w-4 h-4" />
                    Hotel
                  </div>
                  <div className="font-semibold text-gray-900">{formatCurrency(response.budgetBreakdown.hotelCost)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                    <Utensils className="w-4 h-4" />
                    Food
                  </div>
                  <div className="font-semibold text-gray-900">{formatCurrency(response.budgetBreakdown.foodEstimate)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                    <Plane className="w-4 h-4" />
                    Local Transport
                  </div>
                  <div className="font-semibold text-gray-900">{formatCurrency(response.budgetBreakdown.localTransport)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                    <Shield className="w-4 h-4" />
                    Emergency Fund
                  </div>
                  <div className="font-semibold text-gray-900">{formatCurrency(response.budgetBreakdown.emergencyExtra)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-blue-600 text-sm mb-1">Total Budget</div>
                  <div className="font-bold text-blue-700 text-lg">{formatCurrency(response.budgetBreakdown.totalCalculated)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Day-by-Day Itinerary
              </h2>
              <div className="space-y-4">
                {response.dayByDayItinerary.map((day) => (
                  <div key={day.day} className="border-l-4 border-blue-500 pl-4">
                    <div className="font-medium text-gray-900">
                      Day {day.day}: {day.title}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {day.activities.map((activity, idx) => (
                        <li key={idx} className="text-gray-600 text-sm flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          {activity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-yellow-500" />
                  Weather Forecast
                </h2>
                <div className="space-y-2">
                  <div className="text-gray-700">{response.weatherForecast.condition}</div>
                  <div className="text-2xl font-bold text-gray-900">{response.weatherForecast.temperatureC}°C</div>
                  <div className="text-sm text-gray-600">{response.weatherForecast.recommendation}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Bus className="w-5 h-5 text-indigo-600" />
                  Suggested Booking
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Transport</div>
                    <div className="font-medium text-gray-900">{response.suggestedBooking.transport.type}</div>
                    <div className="text-sm text-gray-600">{formatCurrency(response.suggestedBooking.transport.fare)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Hotel</div>
                    <div className="font-medium text-gray-900">{response.suggestedBooking.hotel.name}</div>
                    <div className="text-sm text-gray-600">{formatCurrency(response.suggestedBooking.hotel.pricePerNight)}/night</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    {response.suggestedBooking.recommendedAction}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-2">{response.alternativePlan.title}</h2>
              <div className="flex items-center gap-4 mb-2">
                <div>
                  <div className="text-sm text-gray-600">Total Cost</div>
                  <div className="font-bold text-green-700">{formatCurrency(response.alternativePlan.totalCost)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">You Save</div>
                  <div className="font-bold text-green-700">{formatCurrency(response.alternativePlan.savings)}</div>
                </div>
              </div>
              <p className="text-sm text-gray-600">{response.alternativePlan.details}</p>
            </div>
          </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
