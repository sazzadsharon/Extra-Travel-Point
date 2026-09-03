export type VendorStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export type KycStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

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
  serviceType?: string;
  description?: string | null;
  route?: string | null;
  price: number;
  currency?: string;
  capacity?: number | null;
  availability?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  lifecycleStatus?: ServiceLifecycleStatus;
  locationCity?: string | null;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string | null;
  availableDays?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ServiceLifecycleStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export const SERVICE_TYPES = [
  'BUS',
  'HOTEL',
  'RESTAURANT',
  'TOUR',
  'ACTIVITY',
  'CAR_RENTAL',
  'BOAT',
  'TRANSPORT',
  'OTHER'
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  BUS: 'Bus',
  HOTEL: 'Hotel',
  RESTAURANT: 'Restaurant',
  TOUR: 'Tour',
  ACTIVITY: 'Activity',
  CAR_RENTAL: 'Car Rental',
  BOAT: 'Boat / Launch',
  TRANSPORT: 'Transport',
  OTHER: 'Other'
};

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
  kycStatus: KycStatus;
  kycSubmittedAt?: string | null;
  kycReviewedAt?: string | null;
  kycRejectionReason?: string | null;
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

export interface VendorKyc {
  id: number;
  businessName: string;
  category: string;
  kycStatus: KycStatus;
  kycSubmittedAt?: string | null;
  kycReviewedAt?: string | null;
  kycRejectionReason?: string | null;
  kycData?: {
    businessLegalName?: string;
    businessType?: string;
    ownerName?: string;
    nidNumber?: string;
    tradeLicense?: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
    documentUrl?: string;
  } | null;
  user?: VendorUser;
}

export interface VendorDashboard {
  provider: {
    id: number;
    businessName: string;
    status: VendorStatus;
    isVerified: boolean;
    category: string;
    kycStatus?: KycStatus;
    kycSubmittedAt?: string | null;
    kycReviewedAt?: string | null;
    kycRejectionReason?: string | null;
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
