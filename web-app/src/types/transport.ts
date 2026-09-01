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
  category?: string;
  description?: string | null;
  address?: string;
  city?: string | null;
  phone?: string | null;
  rating: number;
  totalReviews: number;
  isVerified: boolean;
}

export interface BusAvailabilitySlot {
  date: string;
  startTime: string | null;
  endTime: string | null;
  capacity: number | null;
}

export interface Bus {
  id: number;
  name: string;
  route: string | null;
  description: string | null;
  price: number;
  currency: string;
  capacity: number;
  provider: BusProvider;
  availability: BusAvailabilitySlot[];
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

export interface BusListResponse {
  count: number;
  buses: Bus[];
}
