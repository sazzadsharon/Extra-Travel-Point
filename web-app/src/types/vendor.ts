export type VendorStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface VendorUser {
  id: number;
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface Service {
  id: number;
  providerId: number;
  name: string;
  category: string;
  description?: string | null;
  route?: string | null;
  price: number;
  currency?: string;
  capacity?: number | null;
  availability?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: number;
  userId: number;
  businessName: string;
  category: string;
  description?: string | null;
  address: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  logo?: string | null;
  commissionRate: number;
  status: VendorStatus;
  isVerified: boolean;
  isActive: boolean;
  verifiedAt?: string | null;
  reviewedBy?: number | null;
  rejectionReason?: string | null;
  rating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
  user?: VendorUser;
  services?: Service[];
  bookings?: Array<{
    id: number;
    bookingCode: string;
    status: string;
    paymentStatus: string;
    user?: { fullName?: string | null; phone?: string | null };
  }>;
}

export interface VendorDashboard {
  provider: {
    id: number;
    businessName: string;
    status: VendorStatus;
    isVerified: boolean;
    category: string;
  } | null;
  totalServices: number;
  activeServices: number;
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  revenue: {
    gross: number;
    commissionRate: number;
    commission: number;
    vendorPayable: number;
    currency: string;
  };
}
