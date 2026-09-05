export interface PaymentGatewayInitiateInput {
  bookingId: number;
  amount: number;
  currency: string;
  customerPhone?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentGatewayInitiateResult {
  success: boolean;
  transactionId: string;
  gatewayReference?: string;
  checkoutUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
  raw?: Record<string, unknown>;
}

export interface PaymentGatewayVerificationInput {
  gatewayReference: string;
  transactionId: string;
  expectedAmount: number;
  expectedCurrency: string;
}

export interface PaymentGatewayVerificationResult {
  success: boolean;
  status: 'success' | 'failed' | 'pending' | 'unknown';
  amount?: number;
  currency?: string;
  paidAt?: Date;
  raw?: Record<string, unknown>;
}

export interface PaymentGatewayQueryInput {
  gatewayReference: string;
  transactionId: string;
}

export interface PaymentGatewayRefundInput {
  gatewayReference: string;
  transactionId: string;
  amount: number;
  reason?: string;
}

export interface PaymentGatewayRefundResult {
  success: boolean;
  refundReference?: string;
  status: 'refunded' | 'failed' | 'unknown';
  raw?: Record<string, unknown>;
}

export interface PaymentGatewayExecuteInput {
  gatewayReference: string;
  transactionId: string;
}

export interface PaymentGatewayExecuteResult {
  success: boolean;
  status: 'success' | 'failed' | 'pending' | 'unknown';
  providerRefId?: string;
  amount?: number;
  currency?: string;
  paidAt?: Date;
  raw?: Record<string, unknown>;
}

export interface PaymentGateway {
  name: string;
  initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult>;
  execute(input: PaymentGatewayExecuteInput): Promise<PaymentGatewayExecuteResult>;
  verify(input: PaymentGatewayVerificationInput): Promise<PaymentGatewayVerificationResult>;
  queryPayment(input: PaymentGatewayQueryInput): Promise<PaymentGatewayVerificationResult>;
  refund(input: PaymentGatewayRefundInput): Promise<PaymentGatewayRefundResult>;
}

export interface PaymentGatewayConfig {
  provider: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  webhookSecret?: string;
  timeoutMs?: number;
}
