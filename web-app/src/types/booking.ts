/**
 * Booking types for the ETP Web App
 */

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
  totalAmount: number;
}