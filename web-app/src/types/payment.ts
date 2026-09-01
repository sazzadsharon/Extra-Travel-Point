/**
 * Payment types for the ETP Web App
 */

export interface Payment {
  id: number;
  bookingId: number;
  amount: number;
  method: PaymentMethod;
  transactionId: string;
  status: PaymentStatus;
  gatewayResponse?: string | null;
  paidAt?: string | null;
  refundedAt?: string | null;
  refundReason?: string | null;
  createdAt: string;
}

export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'sslcommerz' | 'card' | 'bank';
export type PaymentStatus = 'init' | 'pending' | 'success' | 'failed' | 'refunded';

export interface InitiatePaymentRequest {
  bookingId: number;
  method: PaymentMethod;
  amount: number;
}

export interface InitiatePaymentResponse {
  message: string;
  transactionId: string;
  paymentUrl: string;
  payment: {
    id: number;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
  };
}

export interface VerifyPaymentRequest {
  transactionId: string;
  gatewayReference?: string;
}

export interface VerifyPaymentResponse {
  message: string;
  status: 'success';
  payment: Payment;
}

export interface PaymentError {
  error: string;
}
