/**
 * Booking types for the ETP Web App
 */

import type { Service } from './vendor';

export interface PassengerInfo {
  name: string;
  email: string;
  phone: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  seatNumber?: string;
}

export interface Booking {
  id: number;
  bookingCode: string;
  userId: number;
  providerId: number;
  category: string;
  bookingDate: string;
  travelDate: string;
  returnDate: string | null;
  numberOfPeople: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  qrCode: string | null;
  seatNumbers?: string | null;
  passengerInfo?: string | null;
  route?: string | null;
  serviceId?: number | null;
  service?: Service | null;
  createdAt: string;
  updatedAt: string;
  provider?: ServiceProvider;
  user?: User;
}

export interface ServiceProvider {
  id: number;
  businessName: string;
  category: string;
  description?: string;
  address: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
  logo?: string;
  commissionRate: number;
  isVerified: boolean;
  isActive: boolean;
  rating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  phone: string;
  email?: string | null;
  fullName?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'refunded'
  | 'expired';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface BookingResponse {
  message: string;
  booking: Booking;
  discountApplied: {
    percentage: number;
    discountAmount: number;
    finalAmount: number;
  };
}

export interface CreateBookingRequest {
  providerId: number;
  category: 'bus' | 'flight' | 'hotel' | 'food' | 'tour';
  bookingDate: string;
  travelDate: string;
  numberOfPeople: number;
  seatNumbers?: string[];
  passengers?: PassengerInfo[];
  route?: string;
  totalAmount?: number;
}

export interface CreateServiceBookingRequest {
  bookingDate: string;
  quantity?: number;
  passengers?: PassengerInfo[];
  specialRequest?: string;
}

export interface ServiceBookingResponse {
  message: string;
  booking: Booking;
}

export interface PublicServiceDetail {
  id: number;
  providerId: number;
  name: string;
  serviceType?: string;
  category: string;
  description?: string | null;
  route?: string | null;
  price: number;
  currency?: string;
  capacity?: number | null;
  locationCity?: string | null;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images: string[];
  availableDays: number[] | null;
  startDate?: string | null;
  endDate?: string | null;
  provider: {
    id: number;
    businessName: string;
    category: string;
    city?: string | null;
    logo?: string | null;
    rating?: number;
    totalReviews?: number;
    isVerified?: boolean;
  };
}
