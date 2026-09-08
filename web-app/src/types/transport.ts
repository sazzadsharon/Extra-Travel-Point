export interface Vehicle {
  id: number;
  type: string;
  model: string;
  farePerKm?: number;
  baseFare?: number;
  fixedFare?: number;
  route?: string;
  capacity?: number;
  city?: string;
}

export interface CalculateFareRequest {
  vehicleType: string;
  distanceKm: number;
  isAirportTransfer?: boolean;
}

export interface CalculateFareResponse {
  vehicleType: string;
  distanceKm: number;
  baseFare: number;
  ratePerKm: number;
  estimatedFare: number;
  currency: 'BDT';
  note?: string;
}

export interface SearchFilters {
  from: string;
  to: string;
  date: string;
  passengers: number;
}

export interface BusProvider {
  id: number;
  businessName: string;
  city?: string | null;
  isVerified: boolean;
  rating: number;
  totalReviews: number;
  phone?: string | null;
  address?: string | null;
}

export interface BusRoute {
  id: number;
  origin: string;
  destination: string;
  distanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
}

export interface BusInfo {
  id: number;
  busName: string;
  busType: string;
  registrationNumber?: string | null;
  totalSeats: number;
  amenities?: unknown;
}

export interface Bus {
  id: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  status: string;
  availableSeats: number;
  pricePerSeat: number;
  bookingCutoffMinutes?: number | null;
  bus: BusInfo;
  route: BusRoute;
  provider: BusProvider;
}

export interface BusListResponse {
  count: number;
  trips: Bus[];
}

export interface BusSeat {
  seatNumber: string;
  isAvailable: boolean;
  isLocked?: boolean;
  price: number;
  type: 'Window' | 'Aisle';
}

export interface BusSeatMapResponse {
  busId: number;
  date: string;
  totalSeats: number;
  availableSeats: number;
  pricePerSeat: number;
  currency: string;
  seats: BusSeat[];
}
