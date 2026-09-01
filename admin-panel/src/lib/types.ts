export interface AdminUser {
  id: number;
  phone: string;
  email: string | null;
  fullName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface BookingRow {
  id: number;
  bookingCode: string;
  status: string;
  paymentStatus: string;
  finalAmount: number;
  totalAmount?: number;
  discountAmount?: number;
  category: string;
  travelDate: string;
  createdAt: string;
  user?: { fullName?: string; phone?: string };
}

export interface Vendor {
  id: number;
  businessName: string;
  category: string;
  address: string;
  phone?: string | null;
  commissionRate: number;
  status: string;
  isVerified: boolean;
  isActive: boolean;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  rating?: number;
  totalReviews?: number;
  createdAt: string;
  user?: { id: number; fullName?: string; email?: string; phone?: string };
  _count?: { services: number; bookings: number };
}

export interface VendorCounts {
  status: string;
  _count: { id: number };
}

export interface RevenueStats {
  totalBookings: number;
  paidBookingsCount: number;
  totalRevenue: number;
  totalDiscountsGiven: number;
  currency: string;
}

export interface Fleet {
  buses: any[];
  launches: any[];
  flights: any[];
  hotels: any[];
  drivers: any[];
}

export interface CommissionCoupon {
  defaultCommissionRates: Record<string, string>;
  activeCoupons: Array<{ code: string; discountPercent: number; maxDiscountBDT: number; status: string }>;
}

export interface FraudActivity {
  id: number;
  type: string;
  userId: number;
  ip: string;
  severity: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  adminId: number;
  details: string;
  timestamp: string;
}

export interface Review {
  id: number;
  user: string;
  provider: string;
  rating: number;
  comment: string;
  status: string;
}
