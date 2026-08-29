export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface User {
  id: number;
  phone: string;
  email?: string;
  fullName?: string;
  role: 'customer' | 'vendor' | 'admin';
}

export interface Booking {
  id: number;
  bookingCode: string;
  userId: number;
  providerId: number;
  category: string;
  bookingDate: string;
  travelDate: string;
  numberOfPeople: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  paymentStatus: string;
  qrCode?: string;
  createdAt: string;
}

export interface ServiceProvider {
  id: number;
  userId: number;
  businessName: string;
  category: string;
  description?: string;
  address: string;
  city?: string;
  phone?: string;
  commissionRate: number;
  isVerified: boolean;
  rating: number;
}

export interface TransportVehicle {
  id: number;
  type: string;
  model: string;
  farePerKm?: number;
  baseFare?: number;
  capacity?: number;
  city?: string;
}

export interface RouteInfo {
  origin: string;
  destination: string;
  totalDistanceKm: number;
  estimatedDurationHours: number;
  recommendedRoute: string;
}

export interface TripPlan {
  destination: string;
  duration: number;
  budget: number;
  transport: { type: string; cost: number };
  hotel: { name: string; cost: number };
  touristSpots: Array<{ name: string; cost: number }>;
  dailyItinerary: Array<{
    day: number;
    activities: string[];
    estimatedCost: number;
  }>;
  totalEstimatedCost: number;
}