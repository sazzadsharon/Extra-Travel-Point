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
